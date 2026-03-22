# Troubleshooting

## Instance shows "Offline"

1. Open the Pi-hole URL directly in a browser tab — if that fails, it's a network issue
2. Check the URL format: `http://192.168.1.100` (no trailing slash, no `/admin`)
3. Verify the port if non-standard: `http://pi.hole:8080`
4. Check for CORS errors in **Browser DevTools → Network tab**
5. Ensure the **API version** in Settings matches your Pi-hole version (v5 vs v6)
6. See [CORS & Dev Proxy](cors-and-proxy.md) if the URL opens but Orbital still can't connect

## "Connected but invalid response — check API token"

- The API token or password is wrong or expired
- Re-copy it: Admin → Settings → API / Web Interface → Show API token
- For v6: the session password changes whenever you reset your Pi-hole web password

## Blocking toggle does nothing

The API token requires write permissions. Ensure you're using the full-length token — not a truncated version copied from a partially visible field.

## Query log is empty

- FTL must be running and acting as the DNS resolver
- Run `pihole status` on the Pi-hole — "FTL DNS: Running" must appear
- If you use a separate DNS server (Unbound, dnsmasq), Pi-hole may not log those queries

## Hardware page shows no data

- Most metrics come from an undocumented FTL endpoint; older versions may not expose it
- CPU temperature is unavailable on VMs and containers — this is expected
- If nothing shows at all, run `pihole status` to verify FTL is running

## Charts don't render

- Canvas must be supported — very old browsers may lack it
- Open **DevTools → Console** for errors
- In test environments, Chart.js is intentionally mocked (expected)

## Instances disappear after browser restart

- Orbital stores data in `localStorage`
- If your browser clears site data on close, go to **Site Settings** for the Orbital URL and allow **persistent storage**

## TypeScript errors on `npm run build`

Run `npm run typecheck` first for full diagnostics. Common causes:

- Missing `@types/*` package — check `devDependencies`
- An Ionic component prop type mismatch — cast with `as unknown as T`
- `strict: true` catching a real bug — fix the type, don't disable strict mode

## Import alias `@/` not resolving

Both files must be configured:

`tsconfig.json`:
```json
"paths": { "@/*": ["src/*"] }
```

`vite.config.ts`:
```ts
resolve: { alias: { '@': resolve(__dirname, 'src') } }
```

## Vite dev warning: "Could not auto-determine entry point"

Ensure `index.html` exists at the project root:

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
