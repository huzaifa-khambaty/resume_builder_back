const { v4: uuidv4 } = require("uuid");
const { User } = require("../models");

/**
 * Find user by email
 * @param {string} email
 * @returns {Promise<User|null>}
 */
async function findUserByEmail(email) {
  return User.findOne({ where: { email } });
}

/**
 * Find user by user_id
 * @param {string} userId
 * @returns {Promise<User|null>}
 */
async function findUserById(userId) {
  return User.findOne({ where: { user_id: userId } });
}

/**
 * Persist API token to user
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<void>}
 */
async function saveApiToken(userId, token) {
  await User.update({ api_token: token }, { where: { user_id: userId } });
}

/**
 * Revoke API token if it matches the provided token
 * @param {string} userId
 * @param {string} token
 * @returns {Promise<boolean>} true if a token was revoked
 */
async function revokeApiToken(userId, token) {
  const [affected] = await User.update(
    { api_token: null },
    { where: { user_id: userId, api_token: token } }
  );
  return affected > 0;
}

module.exports = {
  findUserByEmail,
  findUserById,
  saveApiToken,
  revokeApiToken,
};
