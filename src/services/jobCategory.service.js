const { Op } = require("sequelize");
const { JobCategory } = require("../models");

async function findJobCategoryById(jobCategoryId) {
  return JobCategory.findOne({
    where: { job_category_id: jobCategoryId },
    attributes: ["job_category_id", "job_category", "created_at", "updated_at"],
  });
}

async function findJobCategoryByName(name) {
  if (!name) return null;
  // Case-insensitive match
  return JobCategory.findOne({
    where: { job_category: { [Op.iLike]: name } },
    attributes: ["job_category_id", "job_category", "created_at", "updated_at"],
  });
}

module.exports = {
  findJobCategoryById,
  findJobCategoryByName,
};
