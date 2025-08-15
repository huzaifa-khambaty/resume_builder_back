const {
  validateAdminProfileUpdate,
} = require("../validations/user.validation");
const { updateUserById } = require("../services/user.service");

async function updateAdminProfile(req, res) {
  try {
    const { valid, errors, cleaned } = validateAdminProfileUpdate(
      req.body || {}
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const userId = req.admin.user_id;
    const updated = await updateUserById(userId, {
      ...cleaned,
      updated_by: userId,
    });
    const { password, api_token, ...admin } = updated.toJSON();
    return res
      .status(200)
      .json({ success: true, message: "Profile updated", data: { ...admin } });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update admin profile",
      error: err.message,
    });
  }
}

module.exports = {
  updateAdminProfile,
};
