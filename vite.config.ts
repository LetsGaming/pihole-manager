import { defineConfig } from 'vite';
import vue  from '@vitejs/plugin-vue';
import { resolve } from 'path';
import type { Connect } from 'vite';
import http  from 'node:http';
import https from 'node:https';

/**
 * Multi-instance dev proxy
 *
 * Pi-hole doesn't set CORS headers, so the browser blocks direct requests
 * from localhost:5173. All Pi-hole API traffic is routed through the Vite
 * dev server via a custom Node.js middleware so the browser only talks to
 * localhost.
 *
 * Pattern: /pihole-proxy/<base64url(instanceUrl)>/<path>
 *
 * piholeApi.ts rewrites baseURL to this pattern in DEV mode (import.meta.env.DEV).
 * In production the app must be served from the same origin as Pi-hole, or
 * behind a reverse proxy — see docs/cors-and-proxy.md.
 */
function decodeTarget(b64: string): URL | null {
  try {
    const raw = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return new URL(raw);
  } catch {
    return null;
  }
}

function piholeProxyMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/pihole-proxy/')) return next();

    const parts    = req.url.split('/');   // ['', 'pihole-proxy', '<b64>', ...rest]
    const b64      = parts[2];
    const rest     = '/' + parts.slice(3).join('/');
    const target   = decodeTarget(b64);

    if (!target) {
      res.writeHead(400);
      res.end('Invalid proxy target');
      return;
    }

    const isHttps   = target.protocol === 'https:';
    const port      = target.port ? parseInt(target.port, 10) : (isHttps ? 443 : 80);
    const transport = isHttps ? https : http;

    // Preflight — answer immediately so the browser doesn't CORS-block the real request
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin':      req.headers.origin ?? '*',
        'access-control-allow-methods':     'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'access-control-allow-headers':     'Content-Type, Authorization, X-FTL-SID, X-CSRF-TOKEN',
        'access-control-allow-credentials': 'true',
        'access-control-max-age':           '86400',
      });
      res.end();
      return;
    }

    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port,
        path:     rest,
        method:   req.method,
        headers:  { ...req.headers, host: target.host },
      },
      (proxyRes) => {
        const outHeaders: Record<string, string | string[]> = {};
        // Forward all upstream headers except ones we're overriding
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v !== undefined) outHeaders[k] = v;
        }
        // Inject CORS so the browser accepts the response
        outHeaders['access-control-allow-origin']      = req.headers.origin ?? '*';
        outHeaders['access-control-allow-credentials'] = 'true';

        res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      console.error(`[pihole-proxy] → ${target.hostname}:${port}${rest}  ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(`Proxy connection failed: ${err.message}`);
      }
    });

    // Pipe request body (POST, PUT, PATCH)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  };
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'pihole-proxy',
      configureServer(server) {
        server.middlewares.use(piholeProxyMiddleware());
      },
    },
  ],

  resolve: { alias: { '@': resolve(__dirname, 'src') } },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/tests/**', 'src/main.ts', 'src/env.d.ts'],
    },
  },
});
