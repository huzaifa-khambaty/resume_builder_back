const express = require("express");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const { addSimulation } = require("../controllers/simulation.controller");

router.post("/", checkAuth, addSimulation);

module.exports = router;
