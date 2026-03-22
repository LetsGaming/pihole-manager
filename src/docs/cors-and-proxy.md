# CORS & Dev Proxy

Pi-hole does not set `Access-Control-Allow-Origin` headers, so the browser
blocks direct cross-origin API requests from `localhost:5173`.

## Development (built-in proxy)

**No setup required.** When you run `npm run dev`, Orbital automatically routes
all Pi-hole API requests through the Vite dev server proxy to avoid CORS:

```
Browser → localhost:5173/pihole-proxy/<b64(instanceUrl)>/api/... → Pi-hole
```

This works for **any number of instances** simultaneously. The instance URL is
base64-encoded into the proxy path, so each Pi-hole gets its own proxy route.

> This proxy only runs during `npm run dev`. It is not part of the production build.

## Production deployment options

### Option 1 — Serve Orbital from the Pi-hole machine (simplest)

Build and copy to your Pi-hole:

```bash
npm run build
scp -r dist/ pi@192.168.1.100:/var/www/html/orbital/
```

Access via `http://pi.hole/orbital`. No CORS — same origin.

### Option 2 — Nginx reverse proxy

Run Orbital at a domain/subdomain and proxy Pi-hole API traffic through it.
Add to your Nginx config:

```nginx
# Orbital SPA
server {
    listen 80;
    server_name orbital.home.arpa;

    root /var/www/orbital;
    index index.html;
    try_files $uri $uri/ /index.html;

    # Proxy Pi-hole instances by their IP
    # Add one block per Pi-hole instance
    location /pihole-proxy/ {
        # Strip the /pihole-proxy/<base64>/ prefix — rewrite to just the path
        rewrite ^/pihole-proxy/[^/]+/(.*)$ /$1 break;

        # Route to the right instance based on the base64-encoded URL
        # For a single instance, hardcode the upstream:
        proxy_pass http://192.168.1.100;
        proxy_set_header Host $proxy_host;
    }
}
```

For multiple instances with different targets you'll need a Lua/njs script or
separate `location` blocks per instance, or use Option 3.

### Option 3 — Enable CORS on Pi-hole directly

If you control the Pi-hole machine, add CORS headers to its web server config.

**lighttpd** (default on Pi-hole v5):
```
# /etc/lighttpd/conf-enabled/15-pihole-admin.conf
$HTTP["url"] =~ "^/admin/api" {
    setenv.add-response-header = (
        "Access-Control-Allow-Origin"  => "http://orbital.home.arpa",
        "Access-Control-Allow-Headers" => "Authorization, Content-Type, X-FTL-SID",
        "Access-Control-Allow-Methods" => "GET, POST, DELETE, OPTIONS",
    )
}
```

**nginx** (Pi-hole v6):
```nginx
location /api/ {
    add_header 'Access-Control-Allow-Origin'  'http://orbital.home.arpa' always;
    add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type,X-FTL-SID' always;
    add_header 'Access-Control-Allow-Methods' 'GET,POST,DELETE,OPTIONS' always;
    if ($request_method = OPTIONS) { return 204; }
}
```

### Option 4 — Caddy (simplest TLS + proxy)

```caddy
orbital.home.arpa {
    root * /var/www/orbital
    file_server
    try_files {path} /index.html

    # Proxy all Pi-hole instances
    handle /pihole-proxy/* {
        uri strip_prefix /pihole-proxy
        reverse_proxy 192.168.1.100
    }
}
```
