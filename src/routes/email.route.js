const express = require("express");
const router = express.Router();
const controller = require("../controllers/email.controller");

// Accepts token and performs unsubscribe immediately
router.get("/unsubscribe", controller.unsubscribeByToken);

// Public endpoint: allows users to post an email to unsubscribe without token
router.post("/unsubscribe", express.urlencoded({ extended: true }), controller.unsubscribeByEmail);

module.exports = router;
