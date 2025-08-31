const { z } = require("zod");

/**
 * Validate and normalize OAuth profile data from Passport strategies
 * Supports Google/Facebook typical shapes
 * @param {any} profile
 * @returns {{ valid: boolean, errors?: any[], cleaned?: { email: string, name: string, image_url?: string } }}
 */
function validateOAuthProfile(profile) {
  const email = extractEmail(profile);
  const name = extractName(profile);
  const image_url = extractImageUrl(profile);

  const parsed = oauthCleanSchema.safeParse({ email, name, image_url });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const errors = Object.entries(flat.fieldErrors).flatMap(([field, msgs]) =>
      (msgs || []).map((message) => ({ field, message }))
    );
    return { valid: false, errors };
  }

  return { valid: true, cleaned: parsed.data };
}

// Helpers to normalize common Passport profile shapes
function extractEmail(profile) {
  if (!profile) return "";
  if (profile.email) return String(profile.email);
  if (Array.isArray(profile.emails) && profile.emails[0]?.value)
    return String(profile.emails[0].value);
  if (profile._json?.email) return String(profile._json.email);
  return "";
}

function extractName(profile) {
  if (!profile) return "";
  if (profile.displayName) return String(profile.displayName);
  if (profile.name && typeof profile.name === "string") return profile.name;
  if (profile.name && typeof profile.name === "object") {
    const parts = [profile.name.givenName, profile.name.familyName].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  if (profile._json) {
    if (profile._json.name) return String(profile._json.name);
    const parts = [profile._json.given_name, profile._json.family_name].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return "";
}

function extractImageUrl(profile) {
  if (!profile) return undefined;
  if (profile.picture) return String(profile.picture);
  if (Array.isArray(profile.photos) && profile.photos[0])
    return String(profile.photos[0].value || profile.photos[0].url);
  if (profile._json?.picture) return String(profile._json.picture);
  if (profile._json?.avatar_url) return String(profile._json.avatar_url);
  return undefined;
}

// Zod schema for normalized OAuth output
const oauthCleanSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email from OAuth provider"),
  name: z.string().trim().min(1, "Name is required from OAuth provider"),
  image_url: z.string().url().optional(),
});

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
