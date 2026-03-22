# Dashboard

The Dashboard gives an at-a-glance overview of every configured instance and aggregate stats across all of them.

## Instance Cards

Each Pi-hole gets its own card showing:

| Stat | Description |
|---|---|
| Queries | Total DNS queries today |
| Blocked | Queries blocked today |
| Block rate | Percentage of queries blocked |
| Domains | Number of domains in the blocklist |

A **status stripe** at the top of the card indicates connectivity:
- 🟢 Green — online and authenticated
- 🔴 Red — unreachable or auth failed

## Per-Instance Blocking Toggle

The toggle at the bottom of each card enables or disables blocking for **that instance only**. Changes take effect immediately.

## Global Controls

The control bar above the cards acts on **all online instances at once**:

- **Enable All** — re-enables blocking everywhere
- **Disable All** — opens a dialog to choose a duration (30 s to 1 hour, or indefinitely)

## Aggregate Stats

Below the cards, a summary row shows combined totals across all instances: total queries, total blocked, average block rate, and number of domains across all lists.

## Refreshing

Click **Refresh** in the page header to manually poll all instances. Automatic polling runs every 30 seconds by default (configurable in Settings).
