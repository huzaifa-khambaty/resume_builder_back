const { Job, Employer, JobCategory } = require("../models");
const PaginationService = require("./pagination.service");

// Create a new job for an employer
async function createJob(jobData, actorId) {
  const { employer_id, job_category_id, job_title, job_description, no_of_vacancies } = jobData;
  
  // Check if employer exists
  const employer = await Employer.findByPk(employer_id);
  if (!employer) {
    const err = new Error("Employer not found");
    err.status = 404;
    throw err;
  }

  // Check if job category exists
  const jobCategory = await JobCategory.findByPk(job_category_id);
  if (!jobCategory) {
    const err = new Error("Job category not found");
    err.status = 404;
    throw err;
  }

  // Check if job already exists for this employer and category
  const existingJob = await Job.findOne({
    where: { employer_id, job_category_id, job_title },
  });

  if (existingJob) {
    const err = new Error("Job with this title already exists for this employer and category");
    err.status = 409;
    throw err;
  }

  const job = await Job.create({
    employer_id,
    job_category_id,
    job_title,
    job_description: job_description || null,
    no_of_vacancies: no_of_vacancies || 1,
    created_by: actorId,
    updated_by: actorId,
  });

  return job;
}

// Get jobs with pagination and filters
async function listJobs(options = {}) {
  const { page, limit, search, sortBy, sortOrder, employer_id, job_category_id } = options;

  const whereClause = {};
  if (employer_id) whereClause.employer_id = employer_id;
  if (job_category_id) whereClause.job_category_id = job_category_id;

  const include = [
    {
      model: Employer,
      as: "employer",
      attributes: ["employer_id", "employer_name", "email", "website", "sector", "city"],
    },
    {
      model: JobCategory,
      as: "jobCategory",
      attributes: ["job_category_id", "job_category"],
    },
  ];

  const allowedSortFields = [
    "created_at",
    "updated_at",
    "job_title",
    "no_of_vacancies",
  ];

  const searchableFields = [
    "job_title",
    "job_description",
  ];

  const result = await PaginationService.paginate({
    page,
    limit,
    search,
    sortBy,
    sortOrder,
    whereClause,
    include,
    allowedSortFields,
    searchableFields,
    model: Job,
  });

  const { data: payload } = result;
  const { data: rows, ...meta } = payload;
  return { data: rows, meta };
}

// Update a job
async function updateJob(job_id, updateData, actorId) {
  const job = await Job.findByPk(job_id);
  if (!job) {
    const err = new Error("Job not found");
    err.status = 404;
    throw err;
  }

  await job.update({
    ...updateData,
    updated_by: actorId,
  });

  return job;
}

// Delete a job
async function deleteJob(job_id) {
  const job = await Job.findByPk(job_id);
  if (!job) {
    const err = new Error("Job not found");
    err.status = 404;
    throw err;
  }

  await job.destroy();
  return { message: "Job deleted successfully" };
}

module.exports = {
  createJob,
  listJobs,
  updateJob,
  deleteJob,
};
