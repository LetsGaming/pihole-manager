# Query Log

The Query Log displays DNS queries in near-real-time. By default it polls every 5 seconds and shows the most recent 100 entries.

## Filters

| Filter | Options |
|---|---|
| Instance | All instances, or select one |
| Status | All / Blocked / Allowed / Cached |
| Search | Filter by domain name or client IP |
| Fetch count | 50 / 100 / 250 / 500 entries |

## Columns

| Column | Description |
|---|---|
| Time | Query timestamp |
| Domain | The queried hostname |
| Client | Source IP address |
| Type | DNS record type (A, AAAA, MX…) |
| Status | Blocked / Allowed / Cached |
| Response | Resolved IP or block reason |

## Actions per Entry

Right-click or use the icon buttons on a row to:

- **Whitelist** — add a blocked domain to the allow list
- **Blacklist** — add an allowed domain to the deny list
- **Copy** — copy the domain to the clipboard

## Live / Pause

The green dot in the toolbar indicates live polling. Click **Pause** to freeze the log while you inspect entries. Click **Resume** to re-enable polling.

## Sorting

Click any column header to sort. Hold **Shift** and click a second column to add a secondary sort key. Active sort columns are shown as pills above the table — click the × on a pill to remove that sort level.
