/**
 * Integration Tests — Router
 *
 * Uses plain vue-router with createMemoryHistory.
 * Does NOT call router.isReady() — it hangs without a mounted app.
 * push() resolves immediately with memory history.
 */

import { describe, it, expect } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";

const stub = (name: string) => ({ name, template: `<div>${name}</div>` });

const ROUTES = [
  { path: "/", redirect: "/dashboard" },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: stub("Dashboard"),
    meta: { title: "Dashboard" },
  },
  {
    path: "/query-log",
    name: "QueryLog",
    component: stub("QueryLog"),
    meta: { title: "Query Log" },
  },
  {
    path: "/blocklists",
    name: "BlockLists",
    component: stub("BlockLists"),
    meta: { title: "Block Lists" },
  },
  {
    path: "/hardware",
    name: "Hardware",
    component: stub("Hardware"),
    meta: { title: "Hardware" },
  },
  {
    path: "/statistics",
    name: "Statistics",
    component: stub("Statistics"),
    meta: { title: "Statistics" },
  },
  {
    path: "/settings",
    name: "Settings",
    component: stub("Settings"),
    meta: { title: "Settings" },
  },
  {
    path: "/docs",
    name: "Documentation",
    component: stub("Docs"),
    meta: { title: "Documentation" },
  },
];

// Create a fresh router for each test — no isReady() needed
function makeRouter() {
  const r = createRouter({ history: createMemoryHistory(), routes: ROUTES });
  r.afterEach((to) => {
    document.title = to.meta.title
      ? `${to.meta.title as string} — Orbital`
      : "Orbital";
  });
  return r;
}

describe("Router: route definitions", () => {
  it("redirects / to /dashboard", async () => {
    const r = makeRouter();
    await r.push("/");
    expect(r.currentRoute.value.path).toBe("/dashboard");
  });

  it("navigates to /dashboard", async () => {
    const r = makeRouter();
    await r.push("/dashboard");
    expect(r.currentRoute.value.name).toBe("Dashboard");
  });

  it("navigates to /query-log", async () => {
    const r = makeRouter();
    await r.push("/query-log");
    expect(r.currentRoute.value.name).toBe("QueryLog");
  });

  it("navigates to /blocklists", async () => {
    const r = makeRouter();
    await r.push("/blocklists");
    expect(r.currentRoute.value.name).toBe("BlockLists");
  });

  it("navigates to /hardware", async () => {
    const r = makeRouter();
    await r.push("/hardware");
    expect(r.currentRoute.value.name).toBe("Hardware");
  });

  it("navigates to /statistics", async () => {
    const r = makeRouter();
    await r.push("/statistics");
    expect(r.currentRoute.value.name).toBe("Statistics");
  });

  it("navigates to /settings", async () => {
    const r = makeRouter();
    await r.push("/settings");
    expect(r.currentRoute.value.name).toBe("Settings");
  });

  it("navigates to /docs", async () => {
    const r = makeRouter();
    await r.push("/docs");
    expect(r.currentRoute.value.name).toBe("Documentation");
  });
});

describe("Router: page titles", () => {
  it("sets Dashboard — Orbital", async () => {
    const r = makeRouter();
    await r.push("/dashboard");
    expect(document.title).toBe("Dashboard — Orbital");
  });

  it("sets Query Log — Orbital", async () => {
    const r = makeRouter();
    await r.push("/query-log");
    expect(document.title).toBe("Query Log — Orbital");
  });

  it("sets Settings — Orbital", async () => {
    const r = makeRouter();
    await r.push("/settings");
    expect(document.title).toBe("Settings — Orbital");
  });

  it("sets Documentation — Orbital", async () => {
    const r = makeRouter();
    await r.push("/docs");
    expect(document.title).toBe("Documentation — Orbital");
  });

  it("sets Hardware — Orbital", async () => {
    const r = makeRouter();
    await r.push("/hardware");
    expect(document.title).toBe("Hardware — Orbital");
  });
});

describe("Router: meta information", () => {
  it("all non-redirect routes have a title meta", () => {
    ROUTES.filter((r) => !("redirect" in r)).forEach((r) => {
      expect(r.meta?.title).toBeTruthy();
    });
  });

  it("route names are all unique", () => {
    const names = ROUTES.filter((r) => r.name).map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("route paths are all unique", () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("Router: navigation history", () => {
  it("supports back navigation", async () => {
    const r = makeRouter();
    await r.push("/dashboard");
    await r.push("/settings");
    expect(r.currentRoute.value.path).toBe("/settings");
    r.back();
    await new Promise((res) => setTimeout(res, 50));
    expect(r.currentRoute.value.path).toBe("/dashboard");
  });

  it("replace navigates to the target route and current route reflects it", async () => {
    const r = makeRouter();
    await r.push("/dashboard");
    expect(r.currentRoute.value.path).toBe("/dashboard");

    // replace should navigate to /settings, like push
    await r.replace("/settings");
    expect(r.currentRoute.value.path).toBe("/settings");
    expect(r.currentRoute.value.name).toBe("Settings");

    // After another push, current route should be /docs
    await r.push("/docs");
    expect(r.currentRoute.value.path).toBe("/docs");
  });
});
