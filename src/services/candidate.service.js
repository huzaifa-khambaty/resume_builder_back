const { v4: uuidv4 } = require("uuid");
const { Candidate } = require("../models");

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

module.exports = {
  findCandidateByEmail,
  createCandidate,
  saveApiToken,
};
