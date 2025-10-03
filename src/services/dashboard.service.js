const { Op, fn, col } = require("sequelize");
const {
  Candidate,
  CandidateSubscription,
  SubscriptionCountry,
  SubscriptionPlan,
  Country,
  Job,
  Employer,
  Simulation,
} = require("../models");
const {
  getJobListForCandidate,
  findCandidateById,
} = require("./candidate.service");
const { calculateRemainingDays } = require("./subscription.service");
const { getSignedUrl, fileExists } = require("./s3.service");

/**
 * Compute profile completion percentage based on key fields.
 */
function computeProfileCompletion(c) {
  const checks = [
    !!c.full_name,
    !!c.email,
    !!c.phone_no,
    !!c.address,
    !!c.country_id,
    !!c.job_category_id,
    Array.isArray(c.skills) && c.skills.length > 0,
    Array.isArray(c.education) && c.education.length > 0,
    Array.isArray(c.work_experience) && c.work_experience.length > 0,
    !!c.summary,
    !!c.seniority_level,
    !!c.resume_key,
  ];
  const score = checks.reduce((a, b) => a + (b ? 1 : 0), 0);
  const total = checks.length;
  return {
    percentage: Math.round((score / total) * 100),
    total,
    filled: score,
  };
}

async function getActiveSubscription(candidateId) {
  const sub = await CandidateSubscription.findOne({
    where: {
      candidate_id: candidateId,
      status: "active",
      end_date: { [Op.gt]: new Date() },
    },
    include: [
      {
        model: SubscriptionPlan,
        as: "plan",
        attributes: [
          "plan_id",
          "name",
          "description",
          "duration_days",
          "price_per_country",
        ],
      },
      {
        model: SubscriptionCountry,
        as: "countries",
        include: [
          {
            model: Country,
            as: "country",
            attributes: ["country_id", "country", "country_code"],
          },
        ],
      },
    ],
    order: [["end_date", "DESC"]],
  });
  return sub || null;
}

async function getRecentSimulations(candidateId, limit = 5) {
  const items = await Simulation.findAll({
    where: { candidate_id: candidateId },
    order: [["created_at", "DESC"]],
    limit,
  });
  const totals = items.reduce(
    (acc, s) => {
      acc.jobs += Number(s.no_of_jobs || 0);
      acc.shortlisted += Number(s.short_listed || 0);
      return acc;
    },
    { jobs: 0, shortlisted: 0 }
  );
  const successRate =
    totals.jobs > 0 ? Math.round((totals.shortlisted / totals.jobs) * 100) : 0;
  return { items, successRate, totals };
}

async function buildResumeInfo(candidate) {
  const hasResume = !!candidate.resume_key;
  if (!hasResume) return { hasResume: false, key: null, download_url: null };
  const exists = await fileExists(candidate.resume_key);
  if (!exists)
    return { hasResume: false, key: candidate.resume_key, download_url: null };
  const download_url = await getSignedUrl(candidate.resume_key, 3600);
  return {
    hasResume: true,
    key: candidate.resume_key,
    download_url,
    expires_in: 3600,
  };
}

async function getChartsForCandidate(candidateId) {
  // Group by country
  const byCountryRaw = await Simulation.findAll({
    where: { candidate_id: candidateId },
    attributes: [
      "country_id",
      [fn("SUM", col("no_of_jobs")), "totalApplied"],
      [fn("SUM", col("short_listed")), "totalShortlisted"],
    ],
    group: ["country_id"],
    raw: true,
  });
  const countryIds = byCountryRaw.map((r) => r.country_id).filter(Boolean);
  const countries = countryIds.length
    ? await Country.findAll({
        where: { country_id: { [Op.in]: countryIds } },
        attributes: ["country_id", "country", "country_code"],
        raw: true,
      })
    : [];
  const countryMap = new Map(countries.map((c) => [c.country_id, c]));
  const byCountry = byCountryRaw.map((r) => {
    const c = countryMap.get(r.country_id) || {};
    return {
      id: r.country_id,
      name: c.country || null,
      code: c.country_code || null,
      totalApplied: Number(r.totalApplied || 0),
      totalShortlisted: Number(r.totalShortlisted || 0),
    };
  });

  // Group by job category
  const byJobCatRaw = await Simulation.findAll({
    where: { candidate_id: candidateId },
    attributes: [
      "job_category_id",
      [fn("SUM", col("no_of_jobs")), "totalApplied"],
      [fn("SUM", col("short_listed")), "totalShortlisted"],
    ],
    group: ["job_category_id"],
    raw: true,
  });
  const jobCatIds = byJobCatRaw.map((r) => r.job_category_id).filter(Boolean);
  const jobCats = jobCatIds.length
    ? await require("../models").JobCategory.findAll({
        where: { job_category_id: { [Op.in]: jobCatIds } },
        attributes: ["job_category_id", "job_category"],
        raw: true,
      })
    : [];
  const jobCatMap = new Map(jobCats.map((j) => [j.job_category_id, j]));
  const byJobCategory = byJobCatRaw.map((r) => {
    const j = jobCatMap.get(r.job_category_id) || {};
    return {
      id: r.job_category_id,
      name: j.job_category || null,
      totalApplied: Number(r.totalApplied || 0),
      totalShortlisted: Number(r.totalShortlisted || 0),
    };
  });

  return { countries: byCountry, jobCategories: byJobCategory };
}

/**
 * Aggregates all dashboard data for the candidate.
 */
async function getCandidateDashboard(candidateId) {
  // Basic candidate with associations
  const candidate = await findCandidateById(candidateId);
  if (!candidate) {
    const err = new Error("Candidate not found");
    err.status = 404;
    throw err;
  }

  // Profile completion
  const profile = computeProfileCompletion(candidate);

  // Active subscription + remaining days
  const activeSubscription = await getActiveSubscription(candidateId);
  const remainingDays = await calculateRemainingDays(candidateId);

  const subscription = activeSubscription
    ? {
        subscription_id: activeSubscription.subscription_id,
        status: activeSubscription.status,
        start_date: activeSubscription.start_date,
        end_date: activeSubscription.end_date,
        remaining_days: remainingDays,
        country_count: activeSubscription.country_count,
        total_amount: activeSubscription.total_amount,
        plan: activeSubscription.plan || null,
        countries: (activeSubscription.countries || []).map((c) => ({
          country_id: c.country_id,
          country_code: c.country?.country_code,
          country: c.country?.country,
        })),
      }
    : null;

  // Job market stats via existing service
  let jobMarket = null;
  try {
    jobMarket = await getJobListForCandidate(candidateId);
  } catch (e) {
    // If job category not set, keep null but don't fail the whole dashboard
    jobMarket = null;
  }

  // Resume info (signed URL)
  const resume = await buildResumeInfo(candidate);

  // Recent simulations & success rate
  const simulations = await getRecentSimulations(candidateId, 5);

  // Minimal candidate info for header
  const candidateSummary = {
    candidate_id: candidate.candidate_id,
    full_name: candidate.full_name,
    email: candidate.email,
    image_url: candidate.image_url,
    country: candidate.country || null,
    job_category: candidate.job_category || null,
    seniority_level: candidate.seniority_level || null,
  };

  return {
    candidate: candidateSummary,
    profile,
    subscription,
    resume,
    jobMarket,
    simulations,
  };
}

async function getChartsByJobCategory(candidateId, jobCategoryId) {
  // Validate presence
  if (!jobCategoryId) {
    const e = new Error("job_category_id is required");
    e.status = 400;
    throw e;
  }

  // Aggregate simulations by country for this job category
  const rows = await Simulation.findAll({
    where: { candidate_id: candidateId, job_category_id: jobCategoryId },
    attributes: [
      "country_id",
      [fn("SUM", col("no_of_jobs")), "totalApplied"],
      [fn("SUM", col("short_listed")), "shortlisted"],
    ],
    group: ["country_id"],
    raw: true,
  });

  const ids = rows.map((r) => r.country_id).filter(Boolean);
  const countries = ids.length
    ? await Country.findAll({
        where: { country_id: { [Op.in]: ids } },
        attributes: ["country_id", "country", "country_code"],
        raw: true,
      })
    : [];
  const cmap = new Map(countries.map((c) => [c.country_id, c]));

  const result = rows.map((r) => {
    const c = cmap.get(r.country_id) || {};
    return {
      id: r.country_id,
      name: c.country || null,
      code: c.country_code || null,
      totalApplied: Number(r.totalApplied || 0),
      shortlisted: Number(r.shortlisted || 0),
    };
  });

  return { countries: result };
}

module.exports = { getCandidateDashboard, getChartsByJobCategory };

// Date-wise charts for a job category (daily granularity)
async function getChartsByJobCategoryDatewise(candidateId, jobCategoryId, { from, to } = {}) {
  if (!jobCategoryId) {
    const e = new Error("job_category_id is required");
    e.status = 400;
    throw e;
  }

  const where = { candidate_id: candidateId, job_category_id: jobCategoryId };
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(from);
    if (to) where.created_at[Op.lte] = new Date(to);
  }

  // Use date_trunc('day', created_at) for Postgres (JSONB usage suggests PG)
  const periodExpr = fn("date_trunc", "day", col("created_at"));
  const rows = await Simulation.findAll({
    where,
    attributes: [
      "country_id",
      [periodExpr, "period"],
      [fn("SUM", col("no_of_jobs")), "totalApplied"],
      [fn("SUM", col("short_listed")), "shortlisted"],
    ],
    group: ["country_id", periodExpr],
    order: [[periodExpr, "ASC"]],
    raw: true,
  });

  const ids = Array.from(new Set(rows.map((r) => r.country_id).filter(Boolean)));
  const countries = ids.length
    ? await Country.findAll({
        where: { country_id: { [Op.in]: ids } },
        attributes: ["country_id", "country", "country_code"],
        raw: true,
      })
    : [];
  const cmap = new Map(countries.map((c) => [c.country_id, c]));

  // Group rows by country
  const byCountry = new Map();
  for (const r of rows) {
    const key = r.country_id;
    const c = cmap.get(key) || {};
    const item = byCountry.get(key) || {
      id: key,
      name: c.country || null,
      code: c.country_code || null,
      series: [],
    };
    const dt = new Date(r.period);
    item.series.push({
      date: isNaN(dt) ? null : dt.toISOString().slice(0, 10),
      totalApplied: Number(r.totalApplied || 0),
      shortlisted: Number(r.shortlisted || 0),
    });
    byCountry.set(key, item);
  }

  // Sort each series by date asc
  const result = Array.from(byCountry.values()).map((c) => ({
    ...c,
    series: c.series
      .filter((p) => p.date)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  }));

  return { countries: result };
}

module.exports.getChartsByJobCategoryDatewise = getChartsByJobCategoryDatewise;
