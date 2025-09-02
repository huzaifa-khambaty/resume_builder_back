const { v4: uuidv4 } = require("uuid");
const { Candidate, Country, JobCategory } = require("../models");
const PaginationService = require("./pagination.service");
const bcrypt = require("bcryptjs");

/**
 * Find candidate by email
 * @param {string} email
 * @returns {Promise<Candidate|null>}
 */
async function findCandidateByEmail(email) {
  return Candidate.findOne({ where: { email } });
}

/**
 * Create a new candidate using minimal OAuth profile info
 * Ensures created_by is populated (set to the new candidate_id)
 * @param {{ email: string, full_name: string, image_url?: string }} data
 * @returns {Promise<Candidate>}
 */
async function createCandidate(data) {
  const candidateId = uuidv4();
  const payload = {
    candidate_id: candidateId,
    email: data.email,
    full_name: data.full_name,
    image_url: data.image_url || null,
    created_by: candidateId,
  };
  return Candidate.create(payload);
}

/**
 * Create a new candidate with a plaintext password (will be hashed here)
 * Ensures created_by is populated (set to the new candidate_id)
 * @param {{ email: string, full_name: string, password: string }} data
 * @returns {Promise<Candidate>}
 */
async function createCandidateWithPassword(data) {
  const candidateId = uuidv4();
  const hashed = await bcrypt.hash(data.password, 10);
  const payload = {
    candidate_id: candidateId,
    email: data.email,
    full_name: data.full_name,
    password: hashed,
    created_by: candidateId,
  };
  return Candidate.create(payload);
}

/**
 * Find candidate by candidate_id
 * @param {string} candidateId
 * @returns {Promise<Candidate|null>}
 */
async function findCandidateById(candidateId) {
  return Candidate.findOne({
    where: { candidate_id: candidateId },
    include: [
      {
        model: Country,
        as: "country",
        attributes: ["country_id", "country", "country_code"],
      },
      {
        model: JobCategory,
        as: "job_category",
        attributes: ["job_category_id", "job_category"],
      },
    ],
  });
}

/**
 * Update candidate by id with allowed fields only
 * @param {string} candidateId
 * @param {Object} updateData
 * @returns {Promise<Candidate>}
 */
async function updateCandidateById(candidateId, updateData) {
  const allowedFields = [
    "full_name",
    "email",
    "phone",
    "location",
    "bio",
    "skills",
    "work_experience",
    "education",
    "summary",
    "resume_key",
    "seniority_level",
    "job_category_id",
    "country_id",
    "updated_by",
  ];

  // Filter updateData to only include allowed fields
  const allowed = {};
  allowedFields.forEach(field => {
    if (updateData.hasOwnProperty(field)) {
      allowed[field] = updateData[field];
    }
  });

  // Remove undefined keys
  Object.keys(allowed).forEach((k) =>
    allowed[k] === undefined ? delete allowed[k] : null
  );

  await Candidate.update(allowed, { where: { candidate_id: candidateId } });
  return findCandidateById(candidateId);
}

/**
 * Persist API token to candidate
 * @param {string} candidateId
 * @param {string} token
 * @returns {Promise<void>}
 */
async function saveApiToken(candidateId, token) {
  await Candidate.update(
    { api_token: token },
    { where: { candidate_id: candidateId } }
  );
}

/**
 * Revoke API token if it matches the provided token
 * @param {string} candidateId
 * @param {string} token
 * @returns {Promise<boolean>} true if a token was revoked
 */
async function revokeApiToken(candidateId, token) {
  const [affected] = await Candidate.update(
    { api_token: null },
    { where: { candidate_id: candidateId, api_token: token } }
  );
  return affected > 0;
}

/**
 * Get all candidates with pagination and search
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1, min: 1)
 * @param {number} options.limit - Items per page (default: 10, min: 1, max: 100)
 * @param {string} options.search - Search term for candidate name or email
 * @param {string} options.sortBy - Sort field (default: 'created_at')
 * @param {string} options.sortOrder - Sort order 'ASC' or 'DESC' (default: 'DESC')
 * @returns {Promise<Object>} - Returns Laravel-style paginated results
 */
async function list(options = {}) {
  try {
    const result = await PaginationService.paginate({
      model: Candidate,
      page: options.page,
      limit: options.limit,
      search: options.search,
      sortBy: options.sortBy || "created_at",
      sortOrder: options.sortOrder || "DESC",
      attributes: [
        "candidate_id",
        "email",
        "full_name",
        "image_url",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: Country,
          as: "country",
          attributes: ["country_id", "country", "country_code"],
        },
        {
          model: JobCategory,
          as: "job_category",
          attributes: ["job_category_id", "job_category"],
        },
      ],
      searchableFields: ["full_name", "email"],
      allowedSortFields: ["full_name", "email", "created_at", "updated_at"],
      path: "/api/candidates",
    });

    return result;
  } catch (error) {
    throw new Error(`Failed to fetch candidates: ${error.message}`);
  }
}

// ===== Resume Generation via OpenAI =====
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

function buildResumePrompt(
  {
    candidate_name,
    job_category_id,
    email = "",
    seniority_level = "",
    country_id,
    work_experience = [],
    skills = [],
    education = [],
  },
  meta
) {
  const { country_name, country_iso2, job_category_name } = meta;

  return `You are a senior resume writer. Create an ATS-friendly resume.

Candidate Name: ${candidate_name}
Target Role: ${job_category_name}
Country: ${country_name} (ISO2: ${country_iso2})

Work Experience (JSON): ${JSON.stringify(work_experience)}
Skills (JSON): ${JSON.stringify(skills)}
Education (JSON): ${JSON.stringify(education)}

Instructions:
- Output strictly valid JSON only. No markdown, no comments, no extra text.
- Follow the exact JSON schema below. Use null where unknown.
- summary: 200-300 words.
- Each experience.description: 80-150 words. Add 2-5 achievements per role.
- education.description: 40-80 words.

JSON Schema:
{
  "candidate_name": "string",
  "job_category_id": ${JSON.stringify(job_category_id)},
  "job_category_name": ${JSON.stringify(job_category_name)},
  "country_id": ${JSON.stringify(country_id)},
  "country_name": ${JSON.stringify(country_name)},
  "email": ${JSON.stringify(email)},
  "seniority_level": ${JSON.stringify(seniority_level)},
  "summary": "string",
  "experience": [
    {
      "job_title": "string",
      "company_name": "string",
      "location": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null",
      "description": "string",
      "achievements": ["string"]
    }
  ],
  "skills": ["string"],
  "education": [
    {
      "degree": "string",
      "institution_name": "string",
      "location": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "string"
    }
  ]
}`;
}

async function callOpenAIForResume(prompt) {
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
      // If server supports it, uncomment next line to enforce JSON
      // response_format: { type: "json_object" },
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
  const parsed = JSON.parse(message);
  return { raw: message, parsed };
}

async function generateResumeFromProfile(payload) {
  const { country_id, job_category_id } = payload;
  const meta = await getCountryAndCategoryByIds(country_id, job_category_id);
  const prompt = buildResumePrompt(payload, meta);
  const { parsed } = await callOpenAIForResume(prompt);

  // Normalize/ensure top-level fields are present
  return {
    candidate_name: parsed.candidate_name || payload.candidate_name,
    job_category_id: parsed.job_category_id ?? job_category_id,
    job_category_name:
      parsed.job_category_name || meta.job_category_name || null,
    country_id: parsed.country_id ?? country_id,
    country_name: parsed.country_name || meta.country_name || null,
    email: parsed.email || payload.email || null,
    seniority_level: parsed.seniority_level || payload.seniority_level || null,
    summary: parsed.summary || "",
    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
  };
}

module.exports = {
  findCandidateByEmail,
  createCandidate,
  createCandidateWithPassword,
  findCandidateById,
  saveApiToken,
  revokeApiToken,
  list,
  updateCandidateById,
  // resume generation exports
  getCountryAndCategoryByIds,
  buildResumePrompt,
  callOpenAIForResume,
  generateResumeFromProfile,
};
