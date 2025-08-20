const { Country, JobCategory } = require("../models");

async function getCountryAndCategoryByIds(country_id, job_category_id) {
  const [country, jobCategory] = await Promise.all([
    Country.findByPk(country_id),
    JobCategory.findByPk(job_category_id),
  ]);

  if (!country) {
    const err = new Error("Country not found");
    err.status = 404;
    throw err;
  }
  if (!jobCategory) {
    const err = new Error("Job category not found");
    err.status = 404;
    throw err;
  }

  return {
    country_name: country.country,
    country_iso2: country.country_code,
    job_category_name: jobCategory.job_category,
  };
}

function buildEmployerPrompt({
  country_name,
  country_iso2,
  job_category_name,
}) {
  return `You are a data curator. Return employers for the following single position in ${country_name} (ISO2 code: ${country_iso2}):

["${job_category_name}"]

### Instructions
- Return the response in **strict JSON format** as a JSON array with a single object for the provided position.
- Include up to **5 plausible, mid-size or large employers** that commonly hire for the role in ${country_name}.
- Exclude staffing agencies, very small companies, or irrelevant employers.
- Use official **English names** for employers.
- Ensure the response is **neutral, unbiased, and country-appropriate**.
- Do not include markdown (e.g., code blocks), explanations, or any text outside the JSON structure.
- The response must strictly adhere to the JSON schema provided below.
- If no website, sector, city, or notes are available, set them to null.

### JSON Schema
{
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "position": { "type": "string" },
      "country_iso2": { "type": "string", "minLength": 2, "maxLength": 2 },
      "employers": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["name", "country_iso2", "confidence"],
          "properties": {
            "name": { "type": "string", "minLength": 2 },
            "email": { "type": "string", "nullable": true },
            "website": { "type": "string", "nullable": true },
            "sector": { "type": "string", "nullable": true },
            "country_iso2": { "type": "string", "minLength": 2, "maxLength": 2 },
            "city": { "type": "string", "nullable": true },
            "notes": { "type": "string", "nullable": true },
            "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      },
      "rationale": { "type": "string", "nullable": true }
    },
    "required": ["position", "country_iso2", "employers"]
  }
}`;
}

async function callOpenAIForEmployers(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is not configured on the server");
    err.status = 500;
    throw err;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that responds with strict JSON only, adhering to the provided schema, with no markdown or additional text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
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

  // Clean potential code fences and parse
  message = message.replace(/```json\n|\n```/g, "").trim();
  let parsed = JSON.parse(message);

  // Accept either an array (preferred) or a single object and normalize to array
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === "object") {
      parsed = [parsed];
    } else {
      const err = new Error(
        "OpenAI response does not match expected schema (must be an array or object)"
      );
      err.status = 502;
      err.details = message;
      throw err;
    }
  }

  for (const item of parsed) {
    if (
      !item?.position ||
      !item?.country_iso2 ||
      !Array.isArray(item?.employers)
    ) {
      const err = new Error(
        "OpenAI response item does not match expected schema"
      );
      err.status = 502;
      err.details = message;
      throw err;
    }
  }

  return { parsed, raw: message };
}

module.exports = {
  getCountryAndCategoryByIds,
  buildEmployerPrompt,
  callOpenAIForEmployers,
};
