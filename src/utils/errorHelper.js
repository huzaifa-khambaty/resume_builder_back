/**
 * Extract meaningful error message from validation errors
 * @param {Object} errors - Zod validation errors
 * @returns {string} - Professional error message
 */
function getValidationErrorMessage(errors) {
  // Handle custom fieldErrors format (like country validation)
  if (errors.fieldErrors) {
    const firstField = Object.keys(errors.fieldErrors)[0];
    const firstError = errors.fieldErrors[firstField];
    if (Array.isArray(firstError) && firstError.length > 0) {
      return firstError[0];
    }
  }

  // Handle Zod flattened errors
  if (errors.fieldErrors && typeof errors.fieldErrors === 'object') {
    const fields = Object.keys(errors.fieldErrors);
    if (fields.length > 0) {
      const firstField = fields[0];
      const fieldErrors = errors.fieldErrors[firstField];
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        return fieldErrors[0];
      }
    }
  }

  // Handle form errors
  if (errors.formErrors && Array.isArray(errors.formErrors) && errors.formErrors.length > 0) {
    return errors.formErrors[0];
  }

  // Fallback to generic message
  return "Validation failed. Please check your input.";
}

module.exports = {
  getValidationErrorMessage,
};
