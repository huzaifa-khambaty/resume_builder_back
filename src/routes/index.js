const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");

router.use("/auth", authRoute);
router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running!!!" });
});

module.exports = router;
