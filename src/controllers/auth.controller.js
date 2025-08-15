const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  findCandidateByEmail,
  createCandidate,
  createCandidateWithPassword,
  saveApiToken,
  revokeApiToken,
} = require("../services/candidate.service");
const { sendVerificationEmail } = require("../services/email.service");
const {
  validateOAuthProfile,
  validateFormRegister,
  validateFormLogin,
} = require("../validations/auth.validation");

const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
const frontendUrl = process.env.FRONTEND_URL;
const emailTokenSecret = process.env.EMAIL_TOKEN_SECRET || jwtSecret;
const emailTokenExpiresIn = process.env.EMAIL_TOKEN_EXPIRES_IN || "15m";

async function login(req, res) {
  try {
    if (!jwtSecret || !jwtExpiresIn) {
      return res.status(500).json({
        success: false,
        message: "Server auth configuration missing",
        missing: {
          JWT_SECRET: !jwtSecret,
          JWT_EXPIRES_IN: !jwtExpiresIn,
        },
      });
    }

    const { valid, errors, cleaned } = validateFormLogin(req.body || {});
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid login data", errors });
    }

    const { email, password } = cleaned;
    const candidate = await findCandidateByEmail(email);
    if (!candidate || !candidate.password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, candidate.password);
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const payload = {
      candidate_id: candidate.candidate_id,
      email: candidate.email,
      name: candidate.full_name,
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
    await saveApiToken(candidate.candidate_id, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        candidate: {
          candidate_id: candidate.candidate_id,
          email: candidate.email,
          full_name: candidate.full_name,
          image_url: candidate.image_url || null,
        },
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Login failed", error: err.message });
  }
}

async function register(req, res) {
  try {
    if (!jwtSecret || !jwtExpiresIn) {
      return res.status(500).json({
        success: false,
        message: "Server auth configuration missing",
        missing: {
          JWT_SECRET: !jwtSecret,
          JWT_EXPIRES_IN: !jwtExpiresIn,
        },
      });
    }

    const { valid, errors, cleaned } = validateFormRegister(req.body || {});
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid register data", errors });
    }

    const { full_name, email, password } = cleaned;
    const existing = await findCandidateByEmail(email);
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    // Create one-time verification token with signup data
    const emailPayload = { full_name, email, password };
    const oneTimeToken = jwt.sign(emailPayload, emailTokenSecret, {
      expiresIn: emailTokenExpiresIn,
    });

    // Build verification URL
    const backendBase =
      process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const verifyUrl = `${backendBase}/api/auth/verify?token=${encodeURIComponent(
      oneTimeToken
    )}`;

    // Send verification email
    await sendVerificationEmail({
      to: email,
      name: full_name,
      verifyUrl,
      expiresIn: emailTokenExpiresIn,
    });

    return res.status(200).json({
      success: true,
      message:
        "Verification email sent. Please check your inbox to verify your email.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Registration initiation failed",
      error: err.message,
    });
  }
}

// Verify email from one-time signup token, create user, issue final JWT, and redirect
async function verifyEmail(req, res) {
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

    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ success: false, message: "Missing token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, emailTokenSecret);
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const { full_name, email, password } = decoded || {};
    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Token payload incomplete" });
    }

    // If already exists, just issue final JWT
    let candidate = await findCandidateByEmail(email);
    if (!candidate) {
      candidate = await createCandidateWithPassword({
        full_name,
        email,
        password,
      });
    }

    const payload = {
      candidate_id: candidate.candidate_id,
      email: candidate.email,
      name: candidate.full_name,
    };
    const finalToken = jwt.sign(payload, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });
    await saveApiToken(candidate.candidate_id, finalToken);

    // Redirect to frontend with token
    const redirectUrl = `${frontendUrl}/verified?token=${encodeURIComponent(
      finalToken
    )}`;
    return res.redirect(302, redirectUrl);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: err.message,
    });
  }
}

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

// GET /api/auth/me
// Returns current candidate based on Bearer token
async function me(req, res) {
  try {
    // If checkAuth middleware already attached candidate, use it directly
    const { password, api_token, ...candidate } = req.candidate;
    return res.status(200).json({
      success: true,
      data: {
        ...candidate,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch current user",
      error: err.message,
    });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  try {
    const auth = req.headers["authorization"] || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const token = auth.substring("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (e) {
      // Even if token is invalid/expired, respond success to prevent token fishing
      return res.status(200).json({ success: true, message: "Logged out" });
    }

    const candidateId = decoded?.candidate_id;
    if (!candidateId) {
      return res.status(200).json({ success: true, message: "Logged out" });
    }

    await revokeApiToken(candidateId, token);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Logout failed", error: err.message });
  }
}

module.exports = {
  login,
  register,
  googleLogin,
  facebookLogin,
  verifyEmail,
  me,
  logout,
};
