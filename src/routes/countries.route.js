const express = require("express");
const {
  lists
} = require("../controllers/countries.controller");

const router = express.Router();

router.get("/lists", lists);

module.exports = router;
