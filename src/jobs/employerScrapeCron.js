const cron = require("node-cron");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");
const {
  Country,
  JobCategory,
  EmployerScrapeState,
  User,
} = require("../models");
const {
  getCountryAndCategoryByIds,
  buildEmployerPrompt,
  callOpenAIForEmployers,
  saveEmployers,
} = require("../services/employer.service");

const CRON = process.env.EMPLOYER_SCRAPE_CRON || "*/30 * * * *"; // every 30 minutes

let task = null;

async function getOrCreateState() {
  let state = await EmployerScrapeState.findOne();
  if (!state) {
    state = await EmployerScrapeState.create({ running: false });
  }
  return state;
}

async function getOrderedCountries() {
  return Country.findAll({
    attributes: ["country_id", "country"],
    order: [["country", "ASC"]],
  });
}

async function getOrderedJobCategories() {
  return JobCategory.findAll({
    attributes: ["job_category_id", "job_category"],
    order: [["job_category", "ASC"]],
  });
}

function findNextPair(countries, categories, lastCountryId, lastCategoryId) {
  if (!countries.length || !categories.length) {
    return { country: null, category: null };
  }

  // Start at first pair if no state yet
  if (!lastCountryId || !lastCategoryId) {
    return { country: countries[0], category: categories[0] };
  }

  const ci = countries.findIndex((c) => c.country_id === lastCountryId);
  const ki = categories.findIndex((k) => k.job_category_id === lastCategoryId);

  let nextCountryIdx = ci >= 0 ? ci : 0;
  let nextCategoryIdx = ki >= 0 ? ki : -1; // will be advanced below

  // Advance category first
  nextCategoryIdx += 1;
  if (nextCategoryIdx >= categories.length) {
    nextCategoryIdx = 0;
    nextCountryIdx += 1;
    if (nextCountryIdx >= countries.length) {
      // wrap around to the very beginning
      nextCountryIdx = 0;
    }
  }

  return {
    country: countries[nextCountryIdx],
    category: categories[nextCategoryIdx],
  };
}

async function runOnce() {
  try {
    if (!cron.validate(CRON)) {
      logger.warn(
        `EMPLOYER_SCRAPE_CRON is invalid ('${CRON}'); allowing manual runOnce but will not schedule.`
      );
    }

    const state = await getOrCreateState();

    // Avoid overlapping runs
    if (state.running) {
      logger.warn(
        "Employer scrape skipped because a previous run is still marked running"
      );
      return;
    }

    // mark running
    await state.update({ running: true, last_error: null });

    const [countries, categories] = await Promise.all([
      getOrderedCountries(),
      getOrderedJobCategories(),
    ]);

    if (!countries.length || !categories.length) {
      throw new Error("No countries or job categories available to scrape");
    }

    const { country, category } = findNextPair(
      countries,
      categories,
      state.last_country_id,
      state.last_job_category_id
    );

    if (!country || !category) {
      throw new Error("Failed to compute next country/category pair");
    }

    logger.info("Employer scrape cron: starting pair", {
      country_id: country.country_id,
      job_category_id: category.job_category_id,
    });

    // Reuse existing service flow
    const info = await getCountryAndCategoryByIds(
      country.country_id,
      category.job_category_id
    );
    const prompt = buildEmployerPrompt(info);
    const { parsed } = await callOpenAIForEmployers(prompt);

    // Resolve a non-null actorId for auditing and NOT NULL constraints
    let actorId = (process.env.EMPLOYER_SCRAPE_ACTOR_ID || "").trim() || null;
    if (!actorId) {
      try {
        const anyUser = await User.findOne({
          where: { is_active: true },
          attributes: ["user_id"],
        });
        if (anyUser) {
          actorId = anyUser.user_id;
        }
      } catch (e) {
        // ignore and fall through
      }
    }
    if (!actorId) {
      actorId = uuidv4();
    }

    const result = await saveEmployers(
      parsed,
      country.country_id,
      category.job_category_id,
      actorId
    );

    // Save progress
    await state.update({
      last_country_id: country.country_id,
      last_job_category_id: category.job_category_id,
      last_run_status: "success",
      running: false,
      updated_at: new Date(),
    });

    logger.info("Employer scrape cron: completed pair", {
      country_id: country.country_id,
      job_category_id: category.job_category_id,
      result,
    });
  } catch (error) {
    logger.error("Employer scrape cron failed", {
      error: error?.message,
      stack: error?.stack,
    });
    try {
      const state = await getOrCreateState();
      await state.update({
        last_run_status: "error",
        last_error: error?.message || String(error),
        running: false,
        updated_at: new Date(),
      });
    } catch (e) {
      logger.error("Failed to update employer scrape state after error", {
        error: e?.message,
      });
    }
  }
}

function start() {
  if (task) {
    logger.warn("Employer scrape cron already started; skipping re-schedule");
    return task;
  }
  if (!cron.validate(CRON)) {
    logger.error(
      `Invalid EMPLOYER_SCRAPE_CRON expression: ${CRON}. Falling back to '*/30 * * * *'`
    );
  }
  const scheduleToUse = cron.validate(CRON) ? CRON : "*/30 * * * *";
  task = cron.schedule(scheduleToUse, runOnce, { scheduled: true });
  logger.info(`Employer scrape cron scheduled with '${scheduleToUse}'`);
  return task;
}

module.exports = { start, runOnce };
