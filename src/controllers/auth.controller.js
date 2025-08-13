const jwt = require("jsonwebtoken");
const {
  findCandidateByEmail,
  createCandidate,
  saveApiToken,
} = require("../services/candidate.service");
const { validateOAuthProfile } = require("../validations/auth.validation");

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
const frontendUrl = process.env.FRONTEND_URL;

const login = (req, res) => {
  res.status(200).json({ success: true, message: "Login successful" });
};

const register = (req, res) => {
  res.status(201).json({ success: true, message: "Register successful" });
};

async function oauthHandler(req, res) {
  try {
    if (!jwtSecret || !jwtExpiresIn || !frontendUrl) {
      return res.status(500).json({
        success: false,
        message: "Server auth configuration missing",
        missing: {
          JWT_SECRET: !jwtSecret,
          JWT_EXPIRES_IN: !jwtExpiresIn,
          FRONTEND_URL: !frontendUrl,
        },
      });
    }

    const profile = req.user || {};
    const { valid, errors, cleaned } = validateOAuthProfile(profile);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OAuth profile", errors });
    }

    const { email, name, image_url } = cleaned;

    // find or create candidate
    let candidate = await findCandidateByEmail(email);
    if (!candidate) {
      candidate = await createCandidate({ email, full_name: name, image_url });
    }

    // create JWT
    const payload = {
      candidate_id: candidate.candidate_id,
      email: candidate.email,
      name: candidate.full_name,
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

    // persist token for reference
    await saveApiToken(candidate.candidate_id, token);

    // redirect to frontend with token
    return res.redirect(
      `${frontendUrl}/login-success?token=${encodeURIComponent(token)}`
    );
  } catch (err) {
    // fallback to JSON to aid debugging
    return res.status(500).json({
      success: false,
      message: "OAuth login failed",
      error: err.message,
    });
  }
}

const googleLogin = (req, res) => oauthHandler(req, res);

const facebookLogin = (req, res) => oauthHandler(req, res);

module.exports = {
  login,
  register,
  googleLogin,
  facebookLogin,
};
