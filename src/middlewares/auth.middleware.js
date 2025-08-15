const jwt = require("jsonwebtoken");
const { findCandidateById } = require("../services/candidate.service");

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
      return res
        .status(401)
        .json({ success: false, message: "Token has been revoked" });
    }

    req.candidate = { ...candidate.dataValues };
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
