const db = require("../models");
const logger = require("../config/logger");
const candidateService = require("../services/candidate.service");

// Sequelize helpers
const { Op, fn, col, literal } = db.Sequelize;

/**
 * GET /api/admin/dashboard
 * Returns aggregated statistics for the admin dashboard
 */
async function getDashboardStats(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const {
      Candidate,
      User,
      Employer,
      Job,
      Country,
      JobCategory,
      CandidateSubscription,
      SubscriptionPlan,
      SubscriptionCountry,
      Simulation,
      sequelize,
    } = db;

    // Basic counts
    const [
      totalCandidates,
      activeCandidates,
      totalUsers,
      totalEmployers,
      totalJobs,
      totalCountries,
      totalJobCategories,
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      expiredSubscriptions,
      totalSimulations,
    ] = await Promise.all([
      Candidate.count(),
      Candidate.count({ where: { is_active: true } }),
      User.count(),
      Employer.count(),
      Job.count(),
      Country.count(),
      JobCategory.count(),
      CandidateSubscription.count(),
      CandidateSubscription.count({ where: { status: "active" } }),
      CandidateSubscription.count({ where: { status: "cancelled" } }),
      CandidateSubscription.count({ where: { status: "expired" } }),
      Simulation.count(),
    ]);

    // Resume stats
    const [candidatesWithResume] = await Promise.all([
      Candidate.count({ where: { resume_key: { [Op.ne]: null } } }),
    ]);

    // Revenue metrics (sum total_amount where payment_status = completed)
    const [
      [{ total_revenue = 0 } = {}],
      [{ mrr_current = 0 } = {}],
      [{ mrr_previous = 0 } = {}],
    ] = await Promise.all([
      sequelize.query(
        `SELECT COALESCE(SUM(total_amount)::numeric, 0) AS total_revenue
         FROM candidate_subscriptions
         WHERE payment_status = 'completed'`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COALESCE(SUM(total_amount)::numeric, 0) AS mrr_current
         FROM candidate_subscriptions
         WHERE payment_status = 'completed'
           AND created_at >= :startOfMonth AND created_at < :startOfNextMonth`,
        {
          type: sequelize.QueryTypes.SELECT,
          replacements: { startOfMonth, startOfNextMonth },
        }
      ),
      sequelize.query(
        `SELECT COALESCE(SUM(total_amount)::numeric, 0) AS mrr_previous
         FROM candidate_subscriptions
         WHERE payment_status = 'completed'
           AND created_at >= :startPrev AND created_at < :startCurr`,
        {
          type: sequelize.QueryTypes.SELECT,
          replacements: {
            startPrev: startOfPrevMonth,
            startCurr: startOfThisMonth,
          },
        }
      ),
    ]);

    // Revenue by month for last 12 months
    const revenueByMonth = await sequelize.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
              COALESCE(SUM(total_amount)::numeric, 0) AS amount
       FROM candidate_subscriptions
       WHERE payment_status = 'completed'
         AND created_at >= (date_trunc('month', NOW()) - INTERVAL '11 months')
       GROUP BY 1
       ORDER BY 1 ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Subscriptions by plan - removed per request

    // Top countries by subscriptions (via SubscriptionCountry)
    const topCountries = await SubscriptionCountry.findAll({
      attributes: [
        "country_id",
        [fn("COUNT", col("SubscriptionCountry.id")), "count"],
      ],
      include: [
        {
          model: Country,
          as: "country",
          attributes: ["country_id", "country", "country_code"],
        },
      ],
      group: ["SubscriptionCountry.country_id", "country.country_id"],
      order: [[literal("count"), "DESC"]],
      limit: 5,
    });

    // Top categories by candidates
    const topCategories = await Candidate.findAll({
      attributes: [
        "job_category_id",
        [fn("COUNT", col("Candidate.candidate_id")), "count"],
      ],
      include: [
        {
          model: JobCategory,
          as: "job_category",
          attributes: ["job_category_id", "job_category"],
        },
      ],
      where: { job_category_id: { [Op.ne]: null } },
      group: ["Candidate.job_category_id", "job_category.job_category_id"],
      order: [[literal("count"), "DESC"]],
      limit: 5,
    });

    // Employers by country (Top 10)
    const employersByCountry = await Employer.findAll({
      attributes: [
        "country_id",
        [fn("COUNT", col("Employer.employer_id")), "count"],
      ],
      include: [
        {
          model: Country,
          as: "country",
          attributes: ["country_id", "country", "country_code"],
        },
      ],
      where: { country_id: { [Op.ne]: null } },
      group: ["Employer.country_id", "country.country_id"],
      order: [[literal("count"), "DESC"]],
      limit: 10,
    });

    // Simulations summary
    const [[{ sum_jobs = 0, sum_shortlisted = 0 } = {}]] = await Promise.all([
      sequelize.query(
        `SELECT COALESCE(SUM(no_of_jobs), 0) AS sum_jobs,
                COALESCE(SUM(short_listed), 0) AS sum_shortlisted
         FROM simulations`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const recentSimulations = await Simulation.findAll({
      order: [["created_at", "DESC"]],
      limit: 5,
      attributes: [
        "id",
        "candidate_id",
        "country_id",
        "job_category_id",
        "no_of_jobs",
        "short_listed",
        "created_at",
      ],
    });

    // Recent activity
    const [recentCandidates, recentSubscriptions] = await Promise.all([
      Candidate.findAll({
        order: [["created_at", "DESC"]],
        limit: 5,
        attributes: ["candidate_id", "email", "full_name", "created_at"],
      }),
      CandidateSubscription.findAll({
        order: [["created_at", "DESC"]],
        limit: 5,
        attributes: [
          "subscription_id",
          "candidate_id",
          "plan_id",
          "total_amount",
          "status",
          "payment_status",
          "created_at",
        ],
        include: [
          {
            model: Candidate,
            as: "candidate",
            attributes: ["candidate_id", "email", "full_name"],
          },
          {
            model: SubscriptionPlan,
            as: "plan",
            attributes: ["plan_id", "name"],
          },
        ],
      }),
    ]);

    // Subscriptions expiring in next 7 days
    const expiringSoon = await CandidateSubscription.findAll({
      where: {
        status: "active",
        end_date: { [Op.gte]: now, [Op.lte]: sevenDaysFromNow },
      },
      order: [["end_date", "ASC"]],
      limit: 10,
      attributes: ["subscription_id", "candidate_id", "end_date"],
      include: [
        {
          model: Candidate,
          as: "candidate",
          attributes: ["candidate_id", "email", "full_name"],
        },
      ],
    });

    // Construct response
    return res.status(200).json({
      success: true,
      message: "Admin dashboard stats",
      data: {
        totals: {
          total_candidates: totalCandidates,
          active_candidates: activeCandidates,
          total_users: totalUsers,
          total_employers: totalEmployers,
          total_jobs: totalJobs,
          total_countries: totalCountries,
          total_job_categories: totalJobCategories,
          total_subscriptions: totalSubscriptions,
          active_subscriptions: activeSubscriptions,
          cancelled_subscriptions: cancelledSubscriptions,
          expired_subscriptions: expiredSubscriptions,
          total_simulations: totalSimulations,
          candidates_with_resume: candidatesWithResume,
        },
        revenue: {
          total_revenue: Number(total_revenue),
          mrr_current_month: Number(mrr_current),
          mrr_previous_month: Number(mrr_previous),
          revenue_12_months: revenueByMonth,
        },
        breakdowns: {
          top_countries_by_subscriptions: topCountries,
          top_categories_by_candidates: topCategories,
          employers_by_country: employersByCountry,
        },
        recent: {
          candidates: recentCandidates,
          subscriptions: recentSubscriptions,
          simulations: recentSimulations,
        },
        alerts: {
          subscriptions_expiring_7_days: expiringSoon,
        },
      },
    });
  } catch (error) {
    logger?.error?.("getDashboardStats error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard stats",
      error: error.message,
    });
  }
}

/**
 * GET /api/admin/candidates
 * Paginated candidates list for admin with search/sort (reuses candidate.service.list)
 */
async function getAdminCandidates(req, res) {
  try {
    const { page, limit, search, sortBy, sortOrder, country_id, job_category_id, has_resume } = req.query;

    const result = await candidateService.list({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      country_id,
      job_category_id,
      has_resume,
    });

    return res.status(200).json({
      success: true,
      message: "Candidates retrieved successfully",
      ...result,
    });
  } catch (error) {
    logger?.error?.("getAdminCandidates error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve candidates",
      error: error.message,
    });
  }
}

/**
 * GET /api/admin/candidates/:candidateId
 * Candidate detail for admin
 */
async function getAdminCandidateDetail(req, res) {
  try {
    const { candidateId } = req.params;
    const candidate = await candidateService.findCandidateById(candidateId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    // Remove sensitive fields if present
    const json = candidate.toJSON?.() || candidate;
    const { password, api_token, ...safe } = json;

    return res.status(200).json({
      success: true,
      message: "Candidate retrieved successfully",
      data: safe,
    });
  } catch (error) {
    logger?.error?.("getAdminCandidateDetail error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve candidate",
    });
  }
}

module.exports = { getDashboardStats, getAdminCandidates, getAdminCandidateDetail };
