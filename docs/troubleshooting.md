# Troubleshooting

## "Cannot connect to instance"

1. Open the Pi-hole URL directly in a browser tab — if that fails, it's a network issue, not an Orbital issue
2. Check the URL format: `http://192.168.1.100` (no trailing slash, no `/admin`)
3. Verify the port if using a non-standard one: `http://pi.hole:8080`
4. See [CORS & Proxy](./cors-and-proxy.md) if the URL opens in the browser but Orbital can't connect

## "Connected but invalid response — check API token"

- The API token is wrong or expired
- Re-copy it: Pi-hole admin → Settings → API / Web Interface → Show API token
- The token changes whenever you reset the Pi-hole web password

## Hardware page shows very little data

- Most metrics come from an undocumented FTL endpoint; older versions may not expose it
- CPU temperature is unavailable in VMs, LXC containers, and cloud instances — this is normal
- If nothing shows, FTL may not be running: SSH to the Pi-hole and run `pihole status`

## Query log is empty

- FTL must be running and acting as the DNS resolver
- If you're using an external DNS server (e.g. Unbound, dnsmasq separately), Pi-hole may not log queries
- Check: `pihole status` should show "FTL DNS: Running"

## Charts don't render

- `canvas` must be supported — very old browsers may lack it
- If you're seeing a blank space where the chart should be, open DevTools → Console for errors
- In test environments, Chart.js is intentionally mocked

## Instances disappear after browser restart

- Orbital stores data in `localStorage`
- If your browser clears site data on close, go to Site Settings for `localhost` (or your Orbital URL) and allow persistent storage

## Vite dev warning: "Could not auto-determine entry point"

Ensure `index.html` exists at the project root (it should after cloning). If it's
missing, create it:

```html
<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Orbital</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## TypeScript errors on `npm run build`

Run `npm run typecheck` first to see full diagnostics. Common causes:
- Missing `@types/*` package — check `devDependencies`
- An Ionic component prop type mismatch — cast with `as unknown as T` or use the correct Ionic type
- `strict: true` catching a real bug — don't disable strict, fix the type

## Import alias `@/` not resolving

Ensure `tsconfig.json` has:
```json
"paths": { "@/*": ["src/*"] }
```
And `vite.config.ts` has:
```ts
resolve: { alias: { '@': resolve(__dirname, 'src') } }
```
Both must be present.
