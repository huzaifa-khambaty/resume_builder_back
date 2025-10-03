const { Country, JobCategory, Employer, Job } = require("../models");
const PaginationService = require("./pagination.service");

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
- Include up to **25 plausible, mid-size or large employers** that commonly hire for the role in ${country_name}.
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

// Paginated list of employers
async function listEmployers(options = {}) {
  const {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    country_id,
    sector,
    city,
    confidence,
    website,
    name,
  } = options;

  const whereClause = {};

  // Country filter
  if (country_id) whereClause.country_id = country_id;

  // Sector filter
  if (sector) {
    whereClause.sector = {
      [require("sequelize").Op.iLike]: `%${sector}%`,
    };
  }

  // City filter
  if (city) {
    whereClause.city = {
      [require("sequelize").Op.iLike]: `%${city}%`,
    };
  }

  // Exact confidence filter
  if (confidence !== undefined) {
    whereClause.confidence = parseFloat(confidence);
  }

  // Website filter
  if (website) {
    whereClause.website = {
      [require("sequelize").Op.iLike]: `%${website}%`,
    };
  }

  // Name filter
  if (name) {
    whereClause.employer_name = {
      [require("sequelize").Op.iLike]: `%${name}%`,
    };
  }

  const include = [
    {
      model: Country,
      as: "country",
      attributes: ["country_id", "country", "country_code"],
    },
    {
      model: Job,
      as: "jobs",
      attributes: ["job_id", "job_title", "job_description", "no_of_vacancies"],
      include: [
        {
          model: JobCategory,
          as: "jobCategory",
          attributes: ["job_category_id", "job_category"],
        },
      ],
    },
  ];

  const allowedSortFields = [
    "created_at",
    "updated_at",
    "employer_name",
    "email",
    "sector",
    "city",
    "confidence",
  ];

  const searchableFields = [
    "employer_name",
    "email",
    "sector",
    "city",
    "website",
  ];

  const result = await PaginationService.paginate({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    whereClause,
    attributes: { exclude: ["password"] },
    include,
    allowedSortFields,
    searchableFields,
    model: Employer,
  });

  // Normalize to data + meta keys for controllers
  const { data: payload } = result;
  const { data: rows, ...meta } = payload;
  return { data: rows, meta };
}

// Get ALL employers for a given country and job_category (no pagination)
// Returns a normalized payload including country and job category display names
async function getEmployersByCountryAndCategory(country_id, job_category_id) {
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

  const employers = await Employer.findAll({
    where: { country_id },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Job,
        as: "jobs",
        attributes: ["job_id", "job_title", "no_of_vacancies"],
        where: { job_category_id },
        required: true,
        include: [
          {
            model: JobCategory,
            as: "jobCategory",
            attributes: ["job_category_id", "job_category"],
          },
        ],
      },
    ],
    order: [["employer_name", "ASC"]],
  });

  const items = employers.map((e) => ({
    employer_id: e.employer_id,
    employer_name: e.employer_name,
    email: e.email,
    website: e.website,
    sector: e.sector,
    city: e.city,
    notes: e.notes,
    confidence: e.confidence,
  }));

  return {
    country: {
      country_id: country.country_id,
      country_name: country.country,
      country_code: country.country_code,
    },
    job_category: {
      job_category_id: jobCategory.job_category_id,
      job_category_name: jobCategory.job_category,
    },
    employers: items,
  };
}

module.exports = {
  getCountryAndCategoryByIds,
  buildEmployerPrompt,
  callOpenAIForEmployers,
  saveEmployers,
  listEmployers,
  getEmployersByCountryAndCategory,
};

// Save employers parsed from OpenAI response
// parsed: normalized array of items with employers[]
// Uses (employer_name, country_id) to dedupe employer records
// Creates job entries in bridge table for each job_category_id
async function saveEmployers(parsed, country_id, job_category_id, actorId) {
  const created_by = actorId;
  const updated_by = actorId;

  let employersCreated = 0;
  let employersUpdated = 0;
  let jobsCreated = 0;
  let jobsUpdated = 0;

  for (const item of parsed) {
    const employers = Array.isArray(item.employers) ? item.employers : [];
    for (const e of employers) {
      const employer_name = (e.name || "").trim();
      if (!employer_name) continue;

      // Check if employer exists
      let employer = await Employer.findOne({
        where: { employer_name, country_id },
      });

      const employerPayload = {
        employer_name,
        email: e.email || null,
        website: e.website || null,
        sector: e.sector || null,
        city: e.city || null,
        notes: e.notes || null,
        confidence:
          typeof e.confidence === "number" && !isNaN(e.confidence)
            ? e.confidence
            : null,
        country_id,
      };

      if (employer) {
        await employer.update({ ...employerPayload, updated_by });
        employersUpdated += 1;
      } else {
        employer = await Employer.create({
          ...employerPayload,
          created_by,
          updated_by,
        });
        employersCreated += 1;
      }

      // Check if job already exists for this employer and job_category
      const existingJob = await Job.findOne({
        where: {
          employer_id: employer.employer_id,
          job_category_id,
        },
      });

      // Create default job title from job category if not provided
      const job_title = item.position || `${employer_name} Position`;

      const jobPayload = {
        employer_id: employer.employer_id,
        job_category_id,
        job_title,
        job_description: null, // Can be enhanced later
        no_of_vacancies: 1, // Default value
        created_by,
        updated_by,
      };

      if (existingJob) {
        await existingJob.update({ ...jobPayload, updated_by });
        jobsUpdated += 1;
      } else {
        await Job.create(jobPayload);
        jobsCreated += 1;
      }
    }
  }

  return {
    employers: { created: employersCreated, updated: employersUpdated },
    jobs: { created: jobsCreated, updated: jobsUpdated },
  };
}
