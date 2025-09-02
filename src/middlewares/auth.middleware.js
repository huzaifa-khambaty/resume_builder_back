const jwt = require("jsonwebtoken");
const { findCandidateById } = require("../services/candidate.service");
const { findUserById } = require("../services/user.service");

/**
 * checkAuth middleware
 * - Verifies Bearer JWT from Authorization header
 * - Ensures the token matches the stored candidate.api_token (not revoked)
 * - Attaches `req.candidate` and `req.token`
 */
async function checkAuth(req, res, next) {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res
        .status(500)
        .json({ success: false, message: "Server auth configuration missing" });
    }

    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const token = auth.trim();
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const candidateId = decoded?.candidate_id;
    if (!candidateId) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    const candidate = await findCandidateById(candidateId);
    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found" });
    }

    if (candidate.api_token !== token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.candidate = { role: "candidate", ...candidate.dataValues };
    req.token = token;
    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: err.message,
    });
  }
}

module.exports = { checkAuth };

/**
 * checkAdminAuth middleware
 * - Verifies Bearer JWT from Authorization header
 * - Ensures the token matches the stored user.api_token (not revoked)
 * - Attaches `req.admin` and `req.token`
 */
async function checkAdminAuth(req, res, next) {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res
        .status(500)
        .json({ success: false, message: "Server auth configuration missing" });
    }

    const auth = req.headers.authorization?.split(" ")[1];
    if (!auth) {
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const token = auth.trim();
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (e) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const userId = decoded?.user_id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    const user = await findUserById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.api_token !== token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.admin = { role: "admin", ...user.dataValues };
    req.token = token;
    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
      error: err.message,
    });
  }
}

module.exports.checkAdminAuth = checkAdminAuth;
