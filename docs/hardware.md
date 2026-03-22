# Hardware

The Hardware page shows system metrics for each Pi-hole instance. All data comes directly from the Pi-hole API — no SSH or third-party tools required.

## Available Metrics

| Metric | v5 | v6 | Notes |
|---|---|---|---|
| CPU load | ✅ | ✅ | Percentage |
| CPU temperature | ✅ partial | ✅ partial | Hidden on VMs / unsupported hardware |
| Memory usage | ✅ | ✅ | Used / total |
| Disk usage | ✅ | ✅ | Used / total |
| System uptime | ✅ | ✅ | |
| Hostname | ✅ | ✅ | |
| IP address | ✅ | ✅ | |
| Pi-hole version | ✅ | ✅ | |
| FTL version | ✅ | ✅ | |
| Web interface version | ✅ | ✅ | |
| Gravity last updated | ✅ | ✅ | |
| Domains in blocklist | ✅ | ✅ | |

## Severity Colours

Progress bars change colour based on utilisation:

| Range | Colour | Meaning |
|---|---|---|
| 0 – 59% | Blue (accent) | Normal |
| 60 – 79% | Amber | Warning |
| 80%+ | Red | Critical |

Temperature thresholds: normal below 60 °C, warning 60–75 °C, critical above 75 °C.

## Limited Data

Metrics unavailable on your hardware are silently hidden — they will not appear as errors or dashes. This is expected for:

- **CPU temperature** — unavailable in VirtualBox, LXC containers, and most cloud VMs
- **All metrics** — if FTL is not running (`pihole status` to verify)
- **Older v5 installs** — the `api_FTL.php?getSysInfo` endpoint may not be present

If the entire hardware card shows a warning, the instance is offline or the API endpoint is not available on that Pi-hole version.
