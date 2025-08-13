const { z } = require("zod");

/**
 * Validate and normalize OAuth profile data from Passport strategies
 * Supports Google/Facebook typical shapes
 * @param {any} profile
 * @returns {{ valid: boolean, errors?: any[], cleaned?: { email: string, name: string, image_url?: string } }}
 */
function validateOAuthProfile(profile) {
  const errors = [];

  const email =
    (profile &&
      (profile.email ||
        (Array.isArray(profile.emails) &&
          profile.emails[0] &&
          profile.emails[0].value) ||
        (profile._json && profile._json.email))) ||
    "";

  const name =
    (profile &&
      (profile.displayName ||
        (profile.name && typeof profile.name === "string" && profile.name) ||
        (profile.name &&
          typeof profile.name === "object" &&
          [profile.name.givenName, profile.name.familyName]
            .filter(Boolean)
            .join(" ")) ||
        (profile._json &&
          (profile._json.name ||
            [profile._json.given_name, profile._json.family_name]
              .filter(Boolean)
              .join(" "))))) ||
    "";

  const image_url =
    (profile &&
      (profile.picture ||
        (Array.isArray(profile.photos) &&
          profile.photos[0] &&
          (profile.photos[0].value || profile.photos[0].url)) ||
        (profile._json &&
          (profile._json.picture || profile._json.avatar_url)))) ||
    undefined;

  if (!email)
    errors.push({
      field: "email",
      message: "Email is required from OAuth provider",
    });
  if (!name)
    errors.push({
      field: "name",
      message: "Name is required from OAuth provider",
    });

  if (errors.length) return { valid: false, errors };

  return { valid: true, cleaned: { email, name, image_url } };
}

// Zod schemas for form-based auth
const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * Validate candidate register request body
 * @param {any} body
 * @returns {{ valid: boolean, errors?: Record<string, string[]>, cleaned?: { full_name: string, email: string, password: string } }}
 */
function validateFormRegister(body) {
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten().fieldErrors };
  }
  return { valid: true, cleaned: result.data };
}

/**
 * Validate candidate login request body
 * @param {any} body
 * @returns {{ valid: boolean, errors?: Record<string, string[]>, cleaned?: { email: string, password: string } }}
 */
function validateFormLogin(body) {
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten().fieldErrors };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateOAuthProfile,
  validateFormRegister,
  validateFormLogin,
};
