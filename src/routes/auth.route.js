const express = require("express");
const {
  login,
  register,
  googleLogin,
  facebookLogin,
} = require("../controllers/auth.controller");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

router.post("/login", login);
router.post("/register", register);

// Google
router.get(
  "/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

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
