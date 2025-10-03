const { Simulation, Job, Employer } = require("../models");
const {
  validateAddSimulation,
} = require("../validations/simulation.validation");

async function addSimulation(req, res) {
  try {
    const { valid, errors, cleaned } = validateAddSimulation(req.body || {});
    if (!valid) {
      return res.status(400).json({ success: false, errors });
    }

    const candidateId = req?.candidate?.candidate_id;
    if (!candidateId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { country_id, job_category_id } = cleaned;

    // Calculate no_of_jobs from DB: COUNT of jobs in this country and category
    const no_of_jobs = await Job.count({
      where: { job_category_id },
      include: [
        {
          model: Employer,
          as: "employer",
          where: { country_id },
          required: true,
        },
      ],
    });

    const row = await Simulation.create({
      candidate_id: candidateId,
      country_id,
      job_category_id,
      no_of_jobs,
      short_listed: 0,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to add simulation",
      error: err.message,
    });
  }
}

module.exports = { addSimulation };
