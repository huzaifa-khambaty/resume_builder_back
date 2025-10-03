const jwt = require("jsonwebtoken");
const { EmailUnsubscribe } = require("../models");

function buildResponseHtml(message) {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Unsubscribe</title></head><body style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;">${message}</body></html>`;
}

exports.unsubscribeByToken = async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send(buildResponseHtml("Missing token."));
    }
    const secret = process.env.UNSUBSCRIBE_SECRET;
    if (!secret) {
      return res
        .status(500)
        .send(buildResponseHtml("Unsubscribe not configured."));
    }
    const payload = jwt.verify(token, secret);
    const email = (payload && payload.email) || null;
    if (!email) {
      return res.status(400).send(buildResponseHtml("Invalid token payload."));
    }

    const [record, created] = await EmailUnsubscribe.findOrCreate({
      where: { email },
      defaults: {
        email,
        reason: "via-token",
        user_agent: req.get("user-agent") || null,
        ip_address: req.ip || null,
        is_active: true,
      },
    });
    if (!created) {
      await record.update({
        is_active: true,
        reason: "via-token",
        user_agent: req.get("user-agent") || null,
        ip_address: req.ip || null,
      });
    }

    return res.send(
      buildResponseHtml(
        `You've been unsubscribed from future emails for <strong>${email}</strong>.`
      )
    );
  } catch (err) {
    return res
      .status(400)
      .send(buildResponseHtml("Unable to process unsubscribe."));
  }
};

exports.unsubscribeByEmail = async (req, res) => {
  try {
    const email = (req.body.email || "").toString().trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    const [record, created] = await EmailUnsubscribe.findOrCreate({
      where: { email },
      defaults: {
        email,
        reason: req.body.reason || "via-form",
        user_agent: req.get("user-agent") || null,
        ip_address: req.ip || null,
        is_active: true,
      },
    });
    if (!created) {
      await record.update({
        is_active: true,
        reason: req.body.reason || "via-form",
        user_agent: req.get("user-agent") || null,
        ip_address: req.ip || null,
      });
    }

    return res.json({ success: true, message: "Unsubscribed" });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err?.message });
  }
};
