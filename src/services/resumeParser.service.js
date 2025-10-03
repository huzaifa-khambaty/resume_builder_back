const pdfParse = require("pdf-parse");
const logger = require("../config/logger");
const { findCountryByName } = require("./country.service");
const { findJobCategoryByName } = require("./jobCategory.service");
// Uses fetch-based OpenAI API calls to stay consistent with candidate.service.js

async function extractTextFromPdf(buffer) {
  const result = await pdfParse(buffer);
  return (result.text || "").trim();
}

function buildSystemPrompt() {
  return (
    "You are an expert resume parser. Extract key fields from the given resume text and return a STRICT JSON object only. " +
    "Use ISO date format YYYY-MM-DD for dates when possible. If a field is not found, use null or empty array."
  );
}

function buildUserPrompt(resumeText) {
  const schemaHint = `Return JSON with the following exact shape:
{
  "full_name": string | null,
  "seniority_level": string | null,
  "job_category": { "label": string | null } | null,
  "country": { "label": string | null } | null,
  "phone_no": string | null,
  "address": string | null,
  "work_experience": [
    { "job_title": string, "company_name": string, "location": string | null, "start_date": "YYYY-MM-DD" | null, "end_date": "YYYY-MM-DD" | null, "description": string | null }
  ],
  "education": [
    { "degree": string, "major": string | null, "university": string, "start_date": "YYYY-MM-DD" | null, "end_date": "YYYY-MM-DD" | null, "description": string | null }
  ],
  "skills": string | null
}`;
  return `Parse the following resume text and extract fields. ${schemaHint}\n\nRESUME TEXT:\n\n${resumeText}`;
}

async function callOpenAIForExtraction(resumeText) {
  const apiKey = process.env.OPENAI_API_KEY;
  // System prompt augmented to enforce strict JSON only responses
  const systemMsg =
    "You are a helpful assistant that responds with strict JSON only, adhering to the provided schema, with no markdown or additional text. " +
    buildSystemPrompt();
  const userMsg = buildUserPrompt(resumeText);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
      temperature: 0.7,
      // response_format: { type: "json_object" }, // enable if supported
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error("Failed to get response from OpenAI");
    err.status = 502;
    err.details = errText;
    throw err;
  }

  const data = await response.json();
  let message = data?.choices?.[0]?.message?.content || null;
  if (!message) {
    const err = new Error("No content returned from OpenAI");
    err.status = 502;
    throw err;
  }

  try {
    // Clean potential code fences and parse to JSON
    message = message.replace(/```json\n|\n```/g, "").trim();
    return JSON.parse(message);
  } catch (e) {
    logger?.warn?.("OpenAI JSON parse failed; returning empty structure", {
      error: e.message,
    });
    return {};
  }
}

function coalesceString(v) {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

async function mapLookupsToIds(parsed) {
  // Clone
  const result = JSON.parse(JSON.stringify(parsed || {}));

  // Country mapping
  const countryLabel = coalesceString(result?.country?.label);
  if (countryLabel) {
    try {
      const country = await findCountryByName(countryLabel);
      if (country) {
        result.country = {
          value: String(country.country_id),
          label: country.country,
        };
      }
    } catch (e) {
      logger?.warn?.("Country mapping failed", {
        label: countryLabel,
        error: e.message,
      });
    }
  }

  // Job category mapping
  const jcLabel = coalesceString(result?.job_category?.label);
  if (jcLabel) {
    try {
      const jc = await findJobCategoryByName(jcLabel);
      if (jc) {
        result.job_category = {
          value: String(jc.job_category_id),
          label: jc.job_category,
        };
      }
    } catch (e) {
      logger?.warn?.("Job category mapping failed", {
        label: jcLabel,
        error: e.message,
      });
    }
  }

  return result;
}

async function parsePdfResume(buffer) {
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY is not configured";
    logger?.error?.(msg);
    const err = new Error(msg);
    err.status = 500;
    throw err;
  }
  const text = await extractTextFromPdf(buffer);
  if (!text) {
    const err = new Error("Failed to extract text from PDF");
    err.status = 400;
    throw err;
  }
  const raw = await callOpenAIForExtraction(text);

  // Normalize minimally to expected shape
  const normalized = {
    full_name: coalesceString(raw.full_name),
    seniority_level: coalesceString(raw.seniority_level),
    job_category: raw.job_category || null,
    country: raw.country || null,
    phone_no: coalesceString(raw.phone_no),
    address: coalesceString(raw.address),
    work_experience: Array.isArray(raw.work_experience)
      ? raw.work_experience
      : [],
    education: Array.isArray(raw.education) ? raw.education : [],
    skills:
      typeof raw.skills === "string"
        ? raw.skills
        : Array.isArray(raw.skills)
        ? raw.skills.join(",")
        : null,
  };

  const mapped = await mapLookupsToIds(normalized);
  return mapped;
}

module.exports = {
  parsePdfResume,
};
