const express = require("express");
const router = express.Router();
const { checkAdminAuth } = require("../middlewares/auth.middleware");
const { updateAdminProfile } = require("../controllers/user.controller");

router.put("/profile", checkAdminAuth, updateAdminProfile);

module.exports = router;
