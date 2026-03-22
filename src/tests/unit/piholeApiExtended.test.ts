/**
 * Unit Tests — PiholeApiService (extended coverage)
 */

import { describe, it, expect, vi } from "vitest";
import axios, { type AxiosInstance } from "axios";
import PiholeApiService, { errorMessage } from "@/services/piholeApi";
import type { PiholeInstance } from "@/types/instance";

vi.mock("axios");

const inst: PiholeInstance = {
  id: "test",
  name: "Test",
  url: "http://pi.hole",
  apiToken: "test-token",
  apiVersion: "v5",
  status: "online",
  addedAt: "",
};

function mockCreate(getData: unknown, postData: unknown = { success: true }) {
  const mockGet = vi.fn().mockResolvedValue({ data: getData });
  const mockPost = vi.fn().mockResolvedValue({ data: postData });
  vi.mocked(axios.create).mockReturnValue({
    get: mockGet,
    post: mockPost,
    interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
  } as unknown as AxiosInstance);
  return { mockGet, mockPost };
}

describe("PiholeApiService.getQueryLog", () => {
  it("parses raw arrays into QueryEntry objects", async () => {
    const payload = {
      data: [
        [
          1700000001,
          "A",
          "example.com",
          "192.168.1.10",
          "2",
          "0",
          "g",
          "3",
          "1ms",
        ],
      ],
    };
    const { mockGet } = mockCreate(payload);
    const result = await PiholeApiService.getQueryLog(inst, 100);
    expect(mockGet).toHaveBeenCalledWith(
      "/admin/api.php",
      expect.objectContaining({
        params: expect.objectContaining({ getAllQueries: 100 }),
      }),
    );
    expect(result[0].domain).toBe("example.com");
    expect(result[0].status).toBe("allowed");
    expect(result[0].timestamp).toBe(1700000001 * 1000);
  });

  it("returns empty array when data missing", async () => {
    mockCreate({});
    expect(await PiholeApiService.getQueryLog(inst, 50)).toHaveLength(0);
  });
});

describe("PiholeApiService list management", () => {
  it("getList returns data array for blacklist", async () => {
    mockCreate({
      data: [{ id: 1, domain: "evil.com", enabled: 1, comment: "" }],
    });
    const r = await PiholeApiService.getList(inst, "black");
    expect(r[0].domain).toBe("evil.com");
  });

  it("getList returns empty array when no data", async () => {
    mockCreate({});
    expect(await PiholeApiService.getList(inst, "white")).toEqual([]);
  });

  it("addToList posts with add param", async () => {
    const { mockPost } = mockCreate({});
    await PiholeApiService.addToList(inst, "black", "tracker.com", "block");
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/api.php",
      null,
      expect.objectContaining({
        params: expect.objectContaining({ list: "black", add: "tracker.com" }),
      }),
    );
  });

  it("addToList throws when success is false", async () => {
    mockCreate({}, { success: false, message: "Already exists" } as unknown);
    await expect(
      PiholeApiService.addToList(inst, "black", "dupe.com"),
    ).rejects.toThrow("Already exists");
  });

  it("removeFromList posts with sub param", async () => {
    const { mockPost } = mockCreate({});
    await PiholeApiService.removeFromList(inst, "white", "safe.com");
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/api.php",
      null,
      expect.objectContaining({
        params: expect.objectContaining({ sub: "safe.com" }),
      }),
    );
  });
});

describe("PiholeApiService adlist management", () => {
  it("getAdlists returns data array", async () => {
    mockCreate({
      data: [
        {
          id: 1,
          address: "https://hosts.file/list.txt",
          enabled: 1,
          comment: "",
        },
      ],
    });
    expect((await PiholeApiService.getAdlists(inst))[0].address).toBe(
      "https://hosts.file/list.txt",
    );
  });

  it("addAdlist posts to adlist endpoint", async () => {
    const { mockPost } = mockCreate({});
    await PiholeApiService.addAdlist(
      inst,
      "https://new.list/domains.txt",
      "New",
    );
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/api.php",
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          list: "adlist",
          add: "https://new.list/domains.txt",
        }),
      }),
    );
  });

  it("removeAdlist posts sub param", async () => {
    const { mockPost } = mockCreate({});
    await PiholeApiService.removeAdlist(inst, "https://old.list/domains.txt");
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/api.php",
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          sub: "https://old.list/domains.txt",
        }),
      }),
    );
  });

  it("addAdlist throws on failure", async () => {
    mockCreate({}, {
      success: false,
      message: "URL already exists",
    } as unknown);
    await expect(
      PiholeApiService.addAdlist(inst, "https://dupe.list"),
    ).rejects.toThrow("URL already exists");
  });
});

describe("PiholeApiService.getVersions", () => {
  it("fetches version data", async () => {
    mockCreate({ core_current: "v5.17.1", FTL_current: "v5.23" });
    const r = await PiholeApiService.getVersions(inst);
    expect(r.core_current).toBe("v5.17.1");
  });
});

describe("PiholeApiService.getOverTimeData", () => {
  it("returns domains and ads", async () => {
    mockCreate({ domains_over_time: { "1": 5 }, ads_over_time: { "1": 1 } });
    const r = await PiholeApiService.getOverTimeData(inst);
    expect(r.domains["1"]).toBe(5);
  });
  it("returns empty objects when absent", async () => {
    mockCreate({});
    const r = await PiholeApiService.getOverTimeData(inst);
    expect(r.domains).toEqual({});
  });
});

describe("PiholeApiService.getTopDomains", () => {
  it("normalises keys to topDomains/topBlocked", async () => {
    mockCreate({ top_queries: { "g.com": 500 }, top_ads: { "bad.com": 100 } });
    const r = await PiholeApiService.getTopDomains(inst, 10);
    expect(r.topDomains["g.com"]).toBe(500);
    expect(r.topBlocked["bad.com"]).toBe(100);
  });
});

describe("PiholeApiService.getTopClients", () => {
  it("returns top_sources object", async () => {
    mockCreate({ top_sources: { "10.0.0.1": 1000 } });
    expect((await PiholeApiService.getTopClients(inst, 5))["10.0.0.1"]).toBe(
      1000,
    );
  });
});

describe("PiholeApiService blocking control", () => {
  it("enableBlocking sends enable param", async () => {
    const { mockGet } = mockCreate({ status: "enabled" });
    await PiholeApiService.enableBlocking(inst);
    expect(mockGet).toHaveBeenCalledWith(
      "/admin/api.php",
      expect.objectContaining({
        params: expect.objectContaining({ enable: "" }),
      }),
    );
  });

  it("disableBlocking with 0 sends disable:0", async () => {
    const { mockGet } = mockCreate({ status: "disabled" });
    await PiholeApiService.disableBlocking(inst, 0);
    const call = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(call[1].params["disable"]).toBe(0);
  });

  it("disableBlocking with 300 sends disable:300", async () => {
    const { mockGet } = mockCreate({ status: "disabled" });
    await PiholeApiService.disableBlocking(inst, 300);
    const call = mockGet.mock.calls[0] as [
      string,
      { params: Record<string, unknown> },
    ];
    expect(call[1].params["disable"]).toBe(300);
  });
});

describe("PiholeApiService.testConnection", () => {
  it("returns ok:true on valid response", async () => {
    mockCreate({
      status: "enabled",
      dns_queries_today: 0,
      ads_blocked_today: 0,
      ads_percentage_today: 0,
      domains_being_blocked: 0,
      unique_clients: 0,
    });
    const r = await PiholeApiService.testConnection(inst);
    expect(r.ok).toBe(true);
  });

  it("returns ok:false when response invalid", async () => {
    mockCreate({ something: "else" });
    expect((await PiholeApiService.testConnection(inst)).ok).toBe(false);
  });

  it("returns ok:false on network error", async () => {
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as unknown as AxiosInstance);
    const r = await PiholeApiService.testConnection(inst);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ECONNREFUSED");
  });
});

describe("errorMessage helper", () => {
  it("extracts nested API error message", () =>
    expect(
      errorMessage({
        response: { data: { error: { message: "Unauthorized" } } },
      }),
    ).toBe("Unauthorized"));
  it("extracts top-level response message", () =>
    expect(errorMessage({ response: { data: { message: "Not found" } } })).toBe(
      "Not found",
    ));
  it("falls back to err.message", () =>
    expect(errorMessage(new Error("Network error"))).toBe("Network error"));
  it("returns Unknown error for null", () =>
    expect(errorMessage(null)).toBe("Unknown error"));
  it("returns Unknown error for empty obj", () =>
    expect(errorMessage({})).toBe("Unknown error"));
});

describe("PiholeApiService.formatUptime", () => {
  it("formats 1d 1h 1m", () =>
    expect(PiholeApiService.formatUptime(90061)).toBe("1d 1h 1m"));
  it("formats 1h 1m", () =>
    expect(PiholeApiService.formatUptime(3661)).toBe("1h 1m"));
  it("formats 5m", () => expect(PiholeApiService.formatUptime(300)).toBe("5m"));
  it("returns <1m", () =>
    expect(PiholeApiService.formatUptime(30)).toBe("<1m"));
  it("returns null for null", () =>
    expect(PiholeApiService.formatUptime(null)).toBeNull());
  it("formats 2d 3h 15m", () =>
    expect(PiholeApiService.formatUptime(2 * 86400 + 3 * 3600 + 15 * 60)).toBe(
      "2d 3h 15m",
    ));
});

describe("PiholeApiService v6 authentication", () => {
  it("v6 authenticates via POST /api/auth and uses X-FTL-SID header", async () => {
    const v6: PiholeInstance = { ...inst, apiVersion: "v6" };
    // Clear any cached session so auth fires fresh
    PiholeApiService.clearSession(v6.id);

    let capturedHeaders: Record<string, unknown> = {};
    let postBody: unknown = null;

    vi.mocked(axios.create).mockReturnValue({
      post: vi.fn().mockImplementation((_url: string, body: unknown) => {
        postBody = body;
        // Return session ID from POST /api/auth
        return Promise.resolve({
          data: { session: { sid: "test-session-123", valid: true } },
        });
      }),
      get: vi.fn().mockImplementation((url: string) => {
        if (url === "/api/stats/summary")
          return Promise.resolve({
            data: {
              queries: {
                total: 0,
                blocked: 0,
                percent_blocked: 0,
                forwarded: 0,
                cached: 0,
              },
              clients: { active: 0, total: 0 },
              gravity: { domains_being_blocked: 0, last_update: 0 },
            },
          });
        return Promise.resolve({ data: { blocking: true } });
      }),
      interceptors: {
        request: {
          use: vi.fn(
            (
              fn: (c: {
                headers: Record<string, unknown>;
                params: Record<string, unknown>;
              }) => unknown,
            ) => {
              const c = { headers: {}, params: {} };
              fn(c);
              capturedHeaders = c.headers;
            },
          ),
        },
      },
    } as unknown as AxiosInstance);

    await PiholeApiService.getSummary(v6);
    // The auth POST should have sent the password
    expect(postBody).toEqual({ password: "test-token" });
    // Subsequent requests use X-FTL-SID
    expect(capturedHeaders["X-FTL-SID"]).toBe("test-session-123");
    PiholeApiService.clearSession(v6.id);
  });

  it("v5 sets auth param on every request", async () => {
    let capturedParams: Record<string, unknown> | null = null;
    vi.mocked(axios.create).mockReturnValue({
      get: vi
        .fn()
        .mockResolvedValue({
          data: {
            status: "enabled",
            dns_queries_today: 0,
            ads_blocked_today: 0,
            ads_percentage_today: 0,
            domains_being_blocked: 0,
            unique_clients: 0,
          },
        }),
      interceptors: {
        request: {
          use: vi.fn(
            (
              fn: (c: {
                headers: Record<string, unknown>;
                params: Record<string, unknown>;
              }) => unknown,
            ) => {
              const c = { headers: {}, params: {} };
              fn(c);
              capturedParams = c.params;
            },
          ),
        },
      },
    } as unknown as AxiosInstance);
    await PiholeApiService.getSummary(inst);
    expect(capturedParams?.["auth"]).toBe("test-token");
  });
});
