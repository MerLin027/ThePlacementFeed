// Cookie options. The site reaches the API through its own domain (Vercel proxies /api to Render),
// so the session cookies are first-party: SameSite=Lax keeps other sites' requests from carrying
// them, on top of the Origin check (csrfCheck). Secure in production (HTTPS only).
// Clearing a cookie requires the same options it was set with (minus maxAge).
const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
  };
};

const getCookieOptions = (maxAge) => ({
  ...getClearCookieOptions(),
  maxAge,
});

module.exports = { getCookieOptions, getClearCookieOptions };
