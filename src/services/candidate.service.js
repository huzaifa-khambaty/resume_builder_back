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
 * @param {Object} data
 * @returns {Promise<Candidate>}
 */
async function updateCandidateById(candidateId, data) {
  const allowed = {
    full_name: data.full_name,
    country_id: data.country_id,
    seniority_level: data.seniority_level,
    image_url: data.image_url,
    resume_url: data.resume_url,
    job_category_id: data.job_category_id,
    skills: data.skills,
    work_experience: data.work_experience,
    education: data.education,
    updated_by: data.updated_by,
  };
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

module.exports = {
  findCandidateByEmail,
  createCandidate,
  createCandidateWithPassword,
  findCandidateById,
  saveApiToken,
  revokeApiToken,
  list,
  updateCandidateById,
};
