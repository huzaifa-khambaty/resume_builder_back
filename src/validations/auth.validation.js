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
        (profile.name && typeof profile.name === "object" &&
          [profile.name.givenName, profile.name.familyName].filter(Boolean).join(" ")) ||
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

module.exports = { validateOAuthProfile };
