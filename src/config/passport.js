const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;

// Replace with your DB call
const makeProfileObject = (profile) => {
  const picture = Array.isArray(profile.photos)
    ? profile.photos[0] && (profile.photos[0].value || profile.photos[0].url)
    : undefined;
  return {
    id: profile.id,
    name: profile.displayName,
    email: profile.emails?.[0]?.value,
    photos: profile.photos,
    picture,
  };
};

// Google
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = makeProfileObject(profile);
      done(null, user);
    }
  )
);

// Facebook
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: "/api/auth/facebook/callback",
      profileFields: ["id", "displayName", "emails", "photos"],
    },
    (accessToken, refreshToken, profile, done) => {
      const user = makeProfileObject(profile);
      done(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});
