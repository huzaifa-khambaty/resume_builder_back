const cron = require("node-cron");
const sequelize = require("../config/sequelize");
const logger = require("../config/logger");

// Reads env with sensible defaults
const CRON_SCHEDULE = process.env.SIMULATION_SHORTLIST_CRON || "*/15 * * * *"; // every 15 minutes
const INCREMENT_PERCENT = Number(process.env.SIMULATION_SHORTLIST_INCREMENT_PERCENT || 10); // 10%
const MAX_PERCENT = Number(process.env.SIMULATION_SHORTLIST_MAX_PERCENT || 60); // 60%

let task = null;

async function runJobOnce() {
  try {
    // Guardrails
    if (INCREMENT_PERCENT <= 0 || MAX_PERCENT <= 0) {
      logger.warn(
        `Simulation shortlist cron skipped due to non-positive percents: inc=${INCREMENT_PERCENT}, max=${MAX_PERCENT}`
      );
      return;
    }

    // Build raw SQL to efficiently update all rows in a single statement
    // Logic:
    // - target_max = CEIL(no_of_jobs * MAX_PERCENT/100)
    // - increment_by = CEIL(no_of_jobs * INCREMENT_PERCENT/100)
    // - new_short_listed = LEAST(target_max, short_listed + increment_by)
    // - apply only when short_listed < target_max and no_of_jobs > 0
    const sql = `
      UPDATE simulations AS s
      SET short_listed = LEAST(
        CEIL(s.no_of_jobs * :maxPct),
        s.short_listed + CEIL(s.no_of_jobs * :incPct)
      ),
      updated_at = NOW()
      WHERE s.no_of_jobs > 0
        AND s.short_listed < CEIL(s.no_of_jobs * :maxPct);
    `;

    const replacements = {
      incPct: INCREMENT_PERCENT / 100,
      maxPct: MAX_PERCENT / 100,
    };

    const [result] = await sequelize.query(sql, { replacements });

    // Different dialects return different result shapes; log generically
    logger.info(
      `Simulation shortlist cron executed. Schedule=${CRON_SCHEDULE}, inc%=${INCREMENT_PERCENT}, max%=${MAX_PERCENT}`,
      { result }
    );
  } catch (error) {
    logger.error("Simulation shortlist cron failed", { error: error?.message, stack: error?.stack });
  }
}

function start() {
  if (task) {
    logger.warn("Simulation shortlist cron already started; skipping re-schedule");
    return task;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    logger.error(
      `Invalid SIMULATION_SHORTLIST_CRON expression: ${CRON_SCHEDULE}. Falling back to */15 * * * *`
    );
  }

  const scheduleToUse = cron.validate(CRON_SCHEDULE) ? CRON_SCHEDULE : "*/15 * * * *";

  task = cron.schedule(scheduleToUse, runJobOnce, {
    scheduled: true,
  });

  logger.info(
    `Simulation shortlist cron scheduled with '${scheduleToUse}' (inc%=${INCREMENT_PERCENT}, max%=${MAX_PERCENT})`
  );

  return task;
}

module.exports = { start, runJobOnce };
