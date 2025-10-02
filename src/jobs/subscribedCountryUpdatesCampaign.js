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

const CRON_SCHEDULE = process.env.SUBSCRIBED_COUNTRY_UPDATES_CRON || "0 10 * * WED"; // Wednesday 10:00
const TIME_WINDOW_DAYS = Number(process.env.SUBSCRIBED_COUNTRY_UPDATES_WINDOW || 7); // Last 7 days
const BATCH_SIZE = Number(process.env.SUBSCRIBED_COUNTRY_UPDATES_BATCH_SIZE || 500);

let task = null;

/**
 * Get new jobs count in subscribed countries for a candidate within the time window
 */
async function getNewJobsInSubscribedCountries(candidateId, jobCategoryId, timeWindowDays = TIME_WINDOW_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeWindowDays);

  // Get active subscription countries for the candidate
  const now = new Date();
  const subscriptions = await CandidateSubscription.findAll({
    where: {
      candidate_id: candidateId,
      status: "active",
    },
    include: [
      {
        model: SubscriptionCountry,
        as: "countries",
        required: true,
        include: [
          {
            model: Country,
            as: "country",
            attributes: ["country_id", "country"],
          },
        ],
      },
    ],
  });

  const activeCountryIds = new Set();
  const countryNames = new Map();
  let subscriptionExpiry = null;

  for (const sub of subscriptions) {
    // Check if subscription is time-valid
    if (
      sub.start_date &&
      sub.end_date &&
      sub.start_date <= now &&
      sub.end_date >= now
    ) {
      // Track the earliest expiry date
      if (!subscriptionExpiry || sub.end_date < subscriptionExpiry) {
        subscriptionExpiry = sub.end_date;
      }

      (sub.countries || []).forEach((sc) => {
        if (sc.country_id && sc.country) {
          activeCountryIds.add(sc.country_id);
          countryNames.set(sc.country_id, sc.country.country);
        }
      });
    }
  }

  if (activeCountryIds.size === 0) {
    return { countryUpdates: [], totalJobs: 0, subscriptionExpiry: null };
  }

  // Query for new jobs in subscribed countries
  const countryIdsArray = Array.from(activeCountryIds);
  const sql = `
    SELECT 
      c.country_id,
      c.country,
      COUNT(CASE WHEN j.created_at >= :cutoffDate THEN 1 END) AS new_jobs,
      COUNT(j.job_id) AS total_jobs
    FROM countries c
    JOIN employers e ON e.country_id = c.country_id
    JOIN jobs j ON j.employer_id = e.employer_id
    WHERE c.country_id IN (:countryIds)
      AND j.job_category_id = :jobCategoryId
    GROUP BY c.country_id, c.country
    HAVING COUNT(CASE WHEN j.created_at >= :cutoffDate THEN 1 END) > 0
    ORDER BY new_jobs DESC, total_jobs DESC;
  `;

  const [rows] = await sequelize.query(sql, {
    replacements: {
      cutoffDate: cutoffDate.toISOString(),
      countryIds: countryIdsArray,
      jobCategoryId,
    },
  });

  const countryUpdates = rows.map((row) => {
    const newJobs = parseInt(row.new_jobs);
    return {
      country: row.country,
      newJobs: newJobs,
      totalJobs: parseInt(row.total_jobs),
      newJobsText: newJobs === 1 ? "job" : "jobs",
    };
  });

  const totalJobs = countryUpdates.reduce((sum, country) => sum + country.newJobs, 0);

  return {
    countryUpdates,
    totalJobs,
    subscriptionExpiry: subscriptionExpiry ? subscriptionExpiry.toISOString().split('T')[0] : null,
  };
}

async function runJobOnce() {
  try {
    if (!cron.validate(CRON_SCHEDULE)) {
      logger.warn(
        `Subscribed country updates campaign running with invalid cron configured ('${CRON_SCHEDULE}'), but manual trigger is allowed.`
      );
    }

    // Get candidates with active subscriptions and job categories
    const candidates = await Candidate.findAll({
      where: { is_active: true },
      attributes: [
        "candidate_id",
        "email",
        "full_name",
        "job_category_id",
      ],
      include: [
        {
          model: JobCategory,
          as: "job_category",
          attributes: ["job_category_id", "job_category"],
        },
        {
          model: CandidateSubscription,
          as: "subscriptions",
          where: { status: "active" },
          required: true,
          attributes: ["subscription_id", "status", "start_date", "end_date"],
        },
      ],
      limit: BATCH_SIZE,
    });

    let sent = 0;
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN;

    for (const candidate of candidates) {
      if (!candidate.email || !candidate.job_category_id) continue;

      // Check if candidate has any active subscriptions within time range
      const now = new Date();
      const hasActiveSubscription = candidate.subscriptions.some(sub => 
        sub.start_date && sub.end_date && 
        sub.start_date <= now && sub.end_date >= now
      );

      if (!hasActiveSubscription) continue;

      // Get new jobs in subscribed countries
      const jobData = await getNewJobsInSubscribedCountries(
        candidate.candidate_id,
        candidate.job_category_id,
        TIME_WINDOW_DAYS
      );

      // Skip if no new jobs found
      if (jobData.totalJobs === 0) continue;

      // Compose email
      const appName = process.env.APP_NAME || "Next Match";
      const frontend = process.env.FRONTEND_URL || "#";

      // Build auto-login URL to take the user directly to jobs page
      let jobsUrl;
      try {
        if (!jwtSecret || !jwtExpiresIn || !process.env.FRONTEND_URL) {
          throw new Error("Missing JWT or FRONTEND_URL envs");
        }

        const payload = {
          candidate_id: candidate.candidate_id,
          email: candidate.email,
          name: candidate.full_name,
        };
        const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
        await saveApiToken(candidate.candidate_id, token);

        // Direct to jobs page after auto-login
        jobsUrl = `${frontend.replace(
          /\/$/,
          ""
        )}/login-success?token=${encodeURIComponent(token)}&page=jobs`;
      } catch (e) {
        // Fallback to direct jobs page if token generation fails
        logger.warn("Subscribed country updates email: falling back to plain jobs URL", {
          candidate_id: candidate.candidate_id,
          error: e?.message,
        });
        jobsUrl = `${frontend.replace(/\/$/, "")}/candidate/jobs`;
      }

      const jobsText = jobData.totalJobs === 1 ? "job" : "jobs";
      const subject = `${appName} • ${jobData.totalJobs} new ${
        candidate.job_category?.job_category || "job"
      } position${jobData.totalJobs > 1 ? "s" : ""} in your subscribed countries`;

      const text = `Hi ${candidate.full_name || "there"},\n\n` +
        `Great news! We've added ${jobData.totalJobs} new job${jobData.totalJobs > 1 ? "s" : ""} ` +
        `in your subscribed countries for ${candidate.job_category?.job_category || "your field"} positions.\n\n` +
        jobData.countryUpdates
          .map((country) => `• ${country.country}: ${country.newJobs} new job${country.newJobs > 1 ? "s" : ""}`)
          .join("\n") +
        `\n\nView all jobs: ${jobsUrl}\n\n` +
        `This update covers jobs added in the last ${TIME_WINDOW_DAYS} days.`;

      // Build unsubscribe URL
      let unsubscribeUrl = null;
      try {
        const unsubSecret = process.env.UNSUBSCRIBE_SECRET;
        const backendBase = (process.env.BACKEND_URL || ``).trim() || `http://localhost:${process.env.PORT || 4000}`;
        if (unsubSecret && backendBase) {
          const unsubToken = jwt.sign({ email: candidate.email }, unsubSecret, { expiresIn: "90d" });
          unsubscribeUrl = `${backendBase.replace(/\/$/, "")}/api/email/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
        }
      } catch (e) {
        logger.warn("Failed to generate unsubscribe URL", { error: e?.message });
      }

      const html = renderTemplate("subscribed-country-updates", {
        appName,
        year: new Date().getFullYear(),
        name: candidate.full_name || "there",
        jobCategory: candidate.job_category?.job_category || "your field",
        totalJobs: jobData.totalJobs,
        jobsText: jobsText,
        countryUpdates: jobData.countryUpdates,
        timeWindow: TIME_WINDOW_DAYS,
        subscriptionExpiry: jobData.subscriptionExpiry,
        jobsUrl,
        unsubscribeUrl,
      });

      try {
        await sendMail({ to: candidate.email, subject, text, html });
        sent += 1;
        logger.info("Subscribed country updates email sent", {
          candidate_id: candidate.candidate_id,
          email: candidate.email,
          totalJobs: jobData.totalJobs,
          countries: jobData.countryUpdates.length,
        });
      } catch (err) {
        logger.error("Subscribed country updates email failed", {
          candidate_id: candidate.candidate_id,
          error: err?.message,
        });
      }
    }

    logger.info(
      `Subscribed country updates campaign executed. Candidates processed=${candidates.length}, emails sent=${sent}, time_window=${TIME_WINDOW_DAYS} days`
    );
  } catch (error) {
    logger.error("Subscribed country updates campaign failed", {
      error: error?.message,
      stack: error?.stack,
    });
  }
}

function start() {
  if (task) {
    logger.warn(
      "Subscribed country updates campaign already started; skipping re-schedule"
    );
    return task;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    logger.error(
      `Invalid SUBSCRIBED_COUNTRY_UPDATES_CRON expression: ${CRON_SCHEDULE}. Falling back to '0 10 * * WED'`
    );
  }
  const scheduleToUse = cron.validate(CRON_SCHEDULE)
    ? CRON_SCHEDULE
    : "0 10 * * WED";

  task = cron.schedule(scheduleToUse, runJobOnce, { scheduled: true });
  logger.info(
    `Subscribed country updates campaign scheduled with '${scheduleToUse}' (window=${TIME_WINDOW_DAYS} days, batch=${BATCH_SIZE})`
  );
  return task;
}

module.exports = { start, runJobOnce };
