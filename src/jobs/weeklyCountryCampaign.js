const cron = require("node-cron");
const logger = require("../config/logger");
const jwt = require("jsonwebtoken");
const {
  sequelize,
  Candidate,
  Job,
  Employer,
  Country,
  JobCategory,
  CandidateSubscription,
  SubscriptionCountry,
} = require("../models");
const { sendMail } = require("../services/email.service");
const { renderTemplate } = require("../emails/templateRenderer");
const { saveApiToken } = require("../services/candidate.service");

const CRON_SCHEDULE = process.env.WEEKLY_COUNTRY_CAMPAIGN_CRON || "0 9 * * MON"; // Monday 09:00
const TOP_N = Number(process.env.WEEKLY_COUNTRY_CAMPAIGN_TOP_N || 5);
const BATCH_SIZE = Number(
  process.env.WEEKLY_COUNTRY_CAMPAIGN_BATCH_SIZE || 500
);

let task = null;

async function getTopCountriesByCategory(
  jobCategoryId,
  excludeCountryIds = [],
  limit = TOP_N
) {
  const replacements = {
    jobCategoryId,
    limit,
    excludeIds: excludeCountryIds.length ? excludeCountryIds : null,
  };

  const excludeClause = excludeCountryIds.length
    ? "AND e.country_id NOT IN (:excludeIds)"
    : "";

  const sql = `
    SELECT c.country_id, c.country, COUNT(j.job_id) AS job_count
    FROM jobs j
    JOIN employers e ON e.employer_id = j.employer_id
    JOIN countries c ON c.country_id = e.country_id
    WHERE j.job_category_id = :jobCategoryId
      ${excludeClause}
    GROUP BY c.country_id, c.country
    ORDER BY job_count DESC
    LIMIT :limit;
  `;

  const [rows] = await sequelize.query(sql, { replacements });
  return rows || [];
}

async function getActiveSubscriptionCountryIds(candidateId) {
  // Fetch active subscriptions and attached countries
  const now = new Date();
  const subs = await CandidateSubscription.findAll({
    where: {
      candidate_id: candidateId,
      status: "active",
    },
    include: [
      {
        model: SubscriptionCountry,
        as: "countries",
        required: false,
      },
    ],
  });

  const activeCountryIds = new Set();
  for (const s of subs) {
    // filter only time-valid subscriptions
    if (
      s.start_date &&
      s.end_date &&
      s.start_date <= now &&
      s.end_date >= now
    ) {
      (s.countries || []).forEach((sc) => {
        if (sc.country_id) activeCountryIds.add(sc.country_id);
      });
    }
  }
  return Array.from(activeCountryIds);
}

async function runJobOnce() {
  try {
    if (!cron.validate(CRON_SCHEDULE)) {
      logger.warn(
        `Weekly country campaign running with invalid cron configured ('${CRON_SCHEDULE}'), but manual trigger is allowed.`
      );
    }

    // Pull up to BATCH_SIZE candidates with a selected job category
    const candidates = await Candidate.findAll({
      where: { is_active: true },
      attributes: [
        "candidate_id",
        "email",
        "full_name",
        "job_category_id",
        "country_id",
      ],
      include: [
        {
          model: JobCategory,
          as: "job_category",
          attributes: ["job_category_id", "job_category"],
        },
        {
          model: Country,
          as: "country",
          attributes: ["country_id", "country"],
        },
      ],
      limit: BATCH_SIZE,
    });

    let sent = 0;
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
    for (const cand of candidates) {
      if (!cand.email || !cand.job_category_id) continue;

      // Exclude candidate's own country and countries already subscribed
      const excludeIds = [];
      if (cand.country_id) excludeIds.push(cand.country_id);
      const subscribed = await getActiveSubscriptionCountryIds(
        cand.candidate_id
      );
      excludeIds.push(...subscribed);

      const topCountries = await getTopCountriesByCategory(
        cand.job_category_id,
        excludeIds,
        TOP_N
      );
      if (!topCountries.length) continue;

      // Compose email using Handlebars template for consistent styling
      const appName = process.env.APP_NAME || "Next Match";
      const frontend = process.env.FRONTEND_URL || "#";

      // Build auto-login URL to take the user directly to subscriptions after login
      let manageUrl;
      try {
        if (!jwtSecret || !jwtExpiresIn || !process.env.FRONTEND_URL) {
          throw new Error("Missing JWT or FRONTEND_URL envs");
        }

        const payload = {
          candidate_id: cand.candidate_id,
          email: cand.email,
          name: cand.full_name,
        };
        const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
        await saveApiToken(cand.candidate_id, token);

        // e.g. https://frontend/login-success?token=...&page=subscriptions
        manageUrl = `${frontend.replace(
          /\/$/,
          ""
        )}/login-success?token=${encodeURIComponent(token)}&page=subscriptions`;
      } catch (e) {
        // Fallback to direct subscriptions page if token generation fails
        logger.warn("Weekly email: falling back to plain subscriptions URL", {
          candidate_id: cand.candidate_id,
          error: e?.message,
        });
        manageUrl = `${frontend.replace(/\/$/, "")}/candidate/subscriptions`;
      }

      const subject = `${appName} • Top countries for ${
        cand.job_category?.job_category || "your field"
      }`;
      const text =
        `Hi ${
          cand.full_name || "there"
        },\n\nWe found countries with more jobs for ${
          cand.job_category?.job_category || "your selected category"
        }.\nUse the button or open ${manageUrl} to sign in and view subscription options.\n\n` +
        topCountries
          .map((r) => `• ${r.country}: ${r.job_count} jobs`)
          .join("\n");

      // Build unsubscribe URL (signed token)
      let unsubscribeUrl = null;
      try {
        const unsubSecret = process.env.UNSUBSCRIBE_SECRET;
        const backendBase = (process.env.BACKEND_URL || ``).trim() || `http://localhost:${process.env.PORT || 4000}`;
        if (unsubSecret && backendBase) {
          const unsubToken = jwt.sign({ email: cand.email }, unsubSecret, { expiresIn: "90d" });
          unsubscribeUrl = `${backendBase.replace(/\/$/, "")}/api/email/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
        }
      } catch (e) {
        logger.warn("Failed to generate unsubscribe URL", { error: e?.message });
      }

      const html = renderTemplate("weekly-country-suggestions", {
        appName,
        footerNote: process.env.EMAIL_FOOTER_NOTE || `${appName}`,
        year: new Date().getFullYear(),
        name: cand.full_name || "there",
        jobCategory: cand.job_category?.job_category || "your field",
        suggestions: topCountries,
        manageUrl,
        unsubscribeUrl,
      });

      try {
        await sendMail({ to: cand.email, subject, text, html });
        sent += 1;
      } catch (err) {
        logger.error("Weekly country campaign email failed", {
          candidate_id: cand.candidate_id,
          error: err?.message,
        });
      }
    }

    logger.info(
      `Weekly country campaign executed. Candidates processed=${candidates.length}, emails sent=${sent}`
    );
  } catch (error) {
    logger.error("Weekly country campaign failed", {
      error: error?.message,
      stack: error?.stack,
    });
  }
}

function start() {
  if (task) {
    logger.warn(
      "Weekly country campaign already started; skipping re-schedule"
    );
    return task;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    logger.error(
      `Invalid WEEKLY_COUNTRY_CAMPAIGN_CRON expression: ${CRON_SCHEDULE}. Falling back to '0 9 * * MON'`
    );
  }
  const scheduleToUse = cron.validate(CRON_SCHEDULE)
    ? CRON_SCHEDULE
    : "0 9 * * MON";

  task = cron.schedule(scheduleToUse, runJobOnce, { scheduled: true });
  logger.info(
    `Weekly country campaign scheduled with '${scheduleToUse}' (topN=${TOP_N}, batch=${BATCH_SIZE})`
  );
  return task;
}

module.exports = { start, runJobOnce };
