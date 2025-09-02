const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

const TEMPLATES_DIR = path.join(__dirname, "templates");

function loadTemplate(templateName) {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.hbs`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Handlebars template not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function renderTemplate(templateName, variables = {}) {
  const raw = loadTemplate(templateName);
  const template = Handlebars.compile(raw, { noEscape: false });
  return template(variables);
}

module.exports = {
  renderTemplate,
  TEMPLATES_DIR,
};
