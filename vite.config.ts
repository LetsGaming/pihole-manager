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

// Headers that must never be forwarded by a proxy in either direction.
// Forwarding these — especially transfer-encoding — causes Pi-hole's HTTP
// parser to emit "Expected HTTP/, RTSP/ or ICE/" because the framing
// information is connection-scoped, not end-to-end.
const HOP_BY_HOP = new Set([
  'transfer-encoding',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade',
]);

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

    // Strip hop-by-hop headers from the incoming request before forwarding.
    const reqHeaders: Record<string, string | string[] | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) reqHeaders[k] = v;
    }
    reqHeaders['host'] = target.host;

    // Disable keep-alive on the upstream agent so every proxied request gets a
    // fresh TCP connection.  This is critical for SSE endpoints like
    // /api/action/gravity: Pi-hole streams progress as text/event-stream, then
    // closes the connection.  With keep-alive enabled, Node's http.Agent returns
    // that socket to the pool with leftover parser state — the *next* request
    // that reuses it sees the dangling SSE bytes instead of "HTTP/1.1 200 OK"
    // and throws "Parse Error: Expected HTTP/, RTSP/ or ICE/".
    const agent = new (isHttps ? https.Agent : http.Agent)({ keepAlive: false });

    const proxyReq = transport.request(
      {
        hostname: target.hostname,
        port,
        path:     rest,
        method:   req.method,
        headers:  reqHeaders,
        agent,
      },
      (proxyRes) => {
        const outHeaders: Record<string, string | string[]> = {};
        // Forward upstream response headers, but strip hop-by-hop ones.
        // Forwarding transfer-encoding: chunked while Node is already writing
        // a chunked response body causes the browser to see double-wrapped
        // chunks and fail to parse the stream.
        for (const [k, v] of Object.entries(proxyRes.headers)) {
          if (v !== undefined && !HOP_BY_HOP.has(k.toLowerCase())) {
            outHeaders[k] = v;
          }
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

    // Buffer the full request body before forwarding so Content-Length is
    // accurate. Piping directly can cause a mismatch if the browser sends a
    // Content-Length header that the upstream server validates strictly (e.g.
    // Pi-hole v6 FTL returns 400 when the length is wrong or the body arrives
    // incomplete). GET/HEAD have no body.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        proxyReq.setHeader('content-length', body.length);
        if (body.length > 0) proxyReq.write(body);
        proxyReq.end();
      });
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
