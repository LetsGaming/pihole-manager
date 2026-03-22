# Block Lists

Manage Pi-hole's adlists and domain lists. All changes are written directly to the Pi-hole via the API and take effect immediately (or after a gravity update for adlists).

## Tabs

### Adlists

Adlists are remote hosts-format blocklists fetched during a **gravity update**. Add the URL of any standard hosts-format list.

Popular community lists are available as **quick-add buttons** — click one to prefill the URL field.

After adding or removing adlists, click **Update Gravity** to rebuild the blocklist database. Gravity updates run asynchronously on the Pi-hole and typically take 30–120 seconds depending on list count and network speed.

### Blacklist (Deny Exact)

Exact domain names that are **always blocked**, regardless of adlists. Useful for one-off additions without a full gravity update.

### Whitelist (Allow Exact)

Exact domain names that are **always allowed**, even if they appear in an adlist. Use this to unblock false positives.

### Regex Block

Regular expressions matched against queried domains — matching domains are blocked.

```
# Block all subdomains of example.com
(^|\.)example\.com$

# Block any domain containing "tracker"
tracker
```

### Regex Allow

Regular expressions for domains that should always be allowed, even if matched by a regex block rule or adlist.

## Multiple Instances

Use the **instance tab bar** at the top to switch between Pi-holes. Each instance maintains its own list independently — Orbital does not sync lists between instances.

## Gravity Update

Gravity rebuilds the SQLite blocklist database from all enabled adlists. You must run a gravity update after:
- Adding or removing adlists
- Changing adlist enable/disable state

Direct blacklist/whitelist/regex changes do **not** require a gravity update — they take effect immediately.
