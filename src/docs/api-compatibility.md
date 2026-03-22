# Pi-hole API Compatibility

## Supported Versions

| Feature | v5 | v6 |
|---|---|---|
| Summary / status | ✅ | ✅ |
| Enable / disable blocking | ✅ | ✅ |
| Timed disable | ✅ | ✅ |
| Query log | ✅ | ✅ |
| Adlist management | ✅ | ✅ |
| Blacklist / whitelist | ✅ | ✅ |
| Regex lists | ✅ | ✅ |
| Over-time chart data | ✅ | ✅ |
| Top domains / clients | ✅ | ✅ |
| Version info | ✅ | ✅ |
| Gravity update | ✅ | ✅ |
| System info (hardware) | ✅ partial | ✅ partial |

## API Architecture Differences

### v5
- **Base path**: `/admin/api.php`
- **Auth**: `?auth=<hex-token>` appended to every request
- **Token**: Pi-hole admin → Settings → API / Web Interface → Show API token
- **All operations**: GET/POST to the same endpoint with `?param=value` selectors

### v6
- **Base path**: `/api`
- **Auth**: Session-based — POST `/api/auth` with your web password → get `X-FTL-SID` session token, sent as a header on subsequent requests. Sessions are cached in memory and refreshed automatically on 401.
- **Password**: Your Pi-hole web UI login password (Settings → General → Change password)
- **Endpoints**: RESTful — separate paths per resource

### Selecting the Version

When adding a Pi-hole instance in Settings, choose **v5** or **v6** to match your Pi-hole version:
- Pi-hole 5.x → **v5** (API token, hex string)
- Pi-hole 6.x → **v6** (web password)

The form label changes automatically: **"API Token"** for v5, **"Web Password"** for v6.

## v6 Endpoint Mapping

| Operation | v5 | v6 |
|---|---|---|
| Auth | `?auth=TOKEN` on every call | `POST /api/auth {password}` → `X-FTL-SID` |
| Summary stats | `?summary` | `GET /api/stats/summary` |
| Blocking status | `?status` | `GET /api/dns/blocking` |
| Enable blocking | `?enable` | `POST /api/dns/blocking {blocking:true}` |
| Disable blocking | `?disable=N` | `POST /api/dns/blocking {blocking:false,timer:N}` |
| Query log | `?getAllQueries=N` | `GET /api/queries?max_results=N` |
| Top domains | `?topItems=N` | `GET /api/stats/top_domains?count=N` |
| Top clients | `?getQuerySources=N` | `GET /api/stats/top_clients?count=N` |
| Over-time data | `?overTimeData10mins` | `GET /api/history` |
| Adlists | `?list=adlist` | `GET /api/lists?type=block` |
| Add adlist | POST `?list=adlist&add=URL` | `POST /api/lists` |
| Remove adlist | POST `?list=adlist&sub=URL` | `DELETE /api/lists/{id}` |
| Blacklist | `?list=black` | `GET /api/domains?type=deny&kind=exact` |
| Whitelist | `?list=white` | `GET /api/domains?type=allow&kind=exact` |
| Regex blacklist | `?list=regex_black` | `GET /api/domains?type=deny&kind=regex` |
| Versions | `?versions` | `GET /api/version` |
| Gravity update | `?updateGravity` | `POST /api/action/gravity` |
| System info | `api_FTL.php?getSysInfo` | `GET /api/system/info` |

## Hardware Data

- **v5**: undocumented `api_FTL.php?getSysInfo` endpoint
- **v6**: `GET /api/system/info`

Both degrade gracefully when fields are unavailable (VMs, containers). The UI hides null sections automatically.

## Rate Limits

Pi-hole has no documented rate limits, but the API is single-threaded.
Avoid polling intervals below 15 seconds on constrained hardware (Pi Zero, etc.).
