// Cookie options — conditional for cross-domain production (Vercel ↔ Render).
// Clearing a cookie requires the same options it was set with (minus maxAge).
const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'None' : 'Lax',
    path: '/',
  };
};

const getCookieOptions = (maxAge) => ({
  ...getClearCookieOptions(),
  maxAge,
});

module.exports = { getCookieOptions, getClearCookieOptions };
