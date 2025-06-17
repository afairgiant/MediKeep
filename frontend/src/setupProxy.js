const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy all /api requests - this is the main one for your app
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.url);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', proxyRes.statusCode, req.url);
      },
      onError: (err, req, res) => {
        console.log('Proxy error:', err.message);
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ detail: 'Proxy error: ' + err.message }));
      },
    })
  );

  // Only proxy docs-related routes when specifically requested
  app.use(
    ['/docs', '/redoc'],
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
    })
  );

  // Proxy OpenAPI JSON
  app.use(
    '/openapi.json',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
    })
  );

  // Proxy health check
  app.use(
    '/health',
    createProxyMiddleware({
      target: 'http://localhost:8000',
      changeOrigin: true,
      secure: false,
    })
  );
};
