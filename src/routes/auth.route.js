const express = require("express");
const {
  login,
  register,
  googleLogin,
  facebookLogin,
  verifyEmail,
  me,
  logout,
  adminLogin,
  adminMe,
  adminLogout,
} = require("../controllers/auth.controller");
const router = express.Router();
const passport = require("passport");
const { checkAuth, checkAdminAuth } = require("../middlewares/auth.middleware");

router.post("/login", login);
router.post("/register", register);
router.get("/verify", verifyEmail);
router.get("/me", checkAuth, me);
router.post("/logout", checkAuth, logout);

// Admin routes under /auth/admin
router.post("/admin/login", adminLogin);
router.get("/admin/me", checkAdminAuth, adminMe);
router.post("/admin/logout", checkAdminAuth, adminLogout);

// Google
// Initiate Google OAuth; allow ?format=json to request JSON in callback via OAuth state
router.get("/google", (req, res, next) => {
  const wantsJson = req.query.format === "json";
  return passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
    state: wantsJson ? "json" : undefined,
  })(req, res, next);
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  googleLogin
);

// Facebook
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    session: false,
    scope: ["public_profile", "email"],
  })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    session: false,
    failureRedirect: "/login",
  }),
  facebookLogin
);

module.exports = router;
