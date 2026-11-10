// Cabeçalhos HTTP básicos de segurança.
module.exports = function seguranca(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.url.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
};
