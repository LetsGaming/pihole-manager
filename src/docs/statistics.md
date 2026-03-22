# Statistics

The Statistics view shows charts and tables for DNS traffic. Select an instance from the dropdown in the page header, or choose **All Instances** to see aggregated data.

## Overview Cards

Six stat cards summarise the selected instance (or aggregate):

| Card | Description |
|---|---|
| Queries Today | Total DNS queries in the past 24 hours |
| Blocked Today | Queries matched by the blocklist |
| Block Rate | Percentage of queries blocked |
| Domains in Lists | Total number of blocked domains across all adlists |
| Unique Clients | Distinct IP addresses seen |
| Queries Cached | Queries answered from the DNS cache |

## Queries Over Time Chart

A 24-hour area chart showing total queries and blocked queries in 10-minute buckets. Hover over a point to see exact counts.

## Top Domains

Three ranked tables show the most active domains:

- **Top Queried** — domains your network accesses most
- **Top Blocked** — domains Pi-hole blocks most often (good for spotting noisy trackers)
- **Top Clients** — devices generating the most DNS traffic

Each row shows a mini bar proportional to the top result.

## All Instances Mode

When **All Instances** is selected:
- Stats cards show sums across all online instances
- The chart merges over-time data, aligning on 10-minute buckets
- Top domains and clients are fetched from each instance separately and merged
