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
 * Update user (admin) by id with allowed fields only
 * @param {string} userId
 * @param {Object} data
 * @returns {Promise<User>}
 */
async function updateUserById(userId, data) {
  const allowed = {
    full_name: data.full_name,
    updated_by: data.updated_by,
  };
  Object.keys(allowed).forEach((k) =>
    allowed[k] === undefined ? delete allowed[k] : null
  );

  await User.update(allowed, { where: { user_id: userId } });
  return findUserById(userId);
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
  updateUserById,
};
