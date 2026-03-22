import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import PiholeApiService, { errorMessage } from '@/services/piholeApi';
import type { PiholeInstance } from '@/types/instance';

vi.mock('axios');

const inst: Partial<PiholeInstance> = { url: 'http://pi.hole', apiToken: 'test-token', apiVersion: 'v5' };
const instV6: Partial<PiholeInstance> = { ...inst, apiVersion: 'v6' };

type MockClient = {
  mockGet:  ReturnType<typeof vi.fn>;
  mockPost: ReturnType<typeof vi.fn>;
};

function mockCreate(getResponse: unknown, postResponse: unknown = { success: true }): MockClient {
  const mockGet  = vi.fn().mockResolvedValue({ data: getResponse });
  const mockPost = vi.fn().mockResolvedValue({ data: postResponse });
  vi.mocked(axios.create).mockReturnValue({
    get: mockGet, post: mockPost,
    interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
  } as never);
  return { mockGet, mockPost };
}

describe('PiholeApiService.getSummary', () => {
  it('fetches summary', async () => {
    const payload = { status: 'enabled', dns_queries_today: 1234, ads_blocked_today: 56, ads_percentage_today: 4.5, domains_being_blocked: 100000, unique_clients: 3 };
    const { mockGet } = mockCreate(payload);
    const result = await PiholeApiService.getSummary(inst as PiholeInstance);
    expect(mockGet).toHaveBeenCalledWith('/admin/api.php', { params: { summary: '' } });
    expect(result.dns_queries_today).toBe(1234);
  });

  it('works for v6 instance — session auth + actual response shape', async () => {
    const mockPost = vi.fn().mockResolvedValue({ data: { session: { sid: 'sid-abc', valid: true } } });
    const mockGet = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/stats/summary') {
        return Promise.resolve({ data: {
          queries: { total: 9492, blocked: 659, percent_blocked: 6.94, forwarded: 1624, cached: 6721 },
          clients: { active: 18, total: 18 },
          gravity: { domains_being_blocked: 1950125, last_update: 1774168828 },
        }});
      }
      // /api/dns/blocking
      return Promise.resolve({ data: { blocking: true } });
    });
    vi.mocked(axios.create).mockReturnValue({
      get: mockGet, post: mockPost,
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    PiholeApiService.clearSession((instV6 as PiholeInstance).id ?? 'test');
    const result = await PiholeApiService.getSummary(instV6 as PiholeInstance);
    expect(result.status).toBe('enabled');
    expect(result.dns_queries_today).toBe(9492);
    expect(result.ads_blocked_today).toBe(659);
    expect(result.unique_clients).toBe(18);
    expect(result.domains_being_blocked).toBe(1950125);
    expect(result.gravity_last_updated?.absolute).toBe(1774168828);
  });

  it('propagates network errors', async () => {
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Network Error')),
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    await expect(PiholeApiService.getSummary(inst as PiholeInstance)).rejects.toThrow('Network Error');
  });
});

describe('PiholeApiService.getStatus', () => {
  it('calls the status endpoint', async () => {
    const { mockGet } = mockCreate({ status: 'enabled' });
    const result = await PiholeApiService.getStatus(inst as PiholeInstance);
    expect(mockGet).toHaveBeenCalledWith('/admin/api.php', { params: { status: '' } });
    expect(result.status).toBe('enabled');
  });
});

describe('PiholeApiService.getQueryLog', () => {
  it('returns mapped entries', async () => {
    const rawData = [
      [1700000000, 'A',    'example.com', '192.168.1.1', '2', '0', 'N/A',     '0', '0.042'],
      [1700000001, 'AAAA', 'blocked.com', '192.168.1.2', '1', '6', 'gravity', '0', '0.001'],
    ];
    mockCreate({ data: rawData });
    const result = await PiholeApiService.getQueryLog(inst as PiholeInstance, 100);
    expect(result).toHaveLength(2);
    expect(result[0].domain).toBe('example.com');
    expect(result[1].status).toBe('blocked');
  });

  it('returns empty array when data missing', async () => {
    mockCreate({});
    expect(await PiholeApiService.getQueryLog(inst as PiholeInstance, 10)).toEqual([]);
  });
});

describe('PiholeApiService.getAdlists', () => {
  it('returns adlist array', async () => {
    mockCreate({ data: [{ id: 1, address: 'https://example.com/list.txt', enabled: 1 }] });
    const result = await PiholeApiService.getAdlists(inst as PiholeInstance);
    expect(result[0].address).toBe('https://example.com/list.txt');
  });

  it('returns empty array when missing', async () => {
    mockCreate({});
    expect(await PiholeApiService.getAdlists(inst as PiholeInstance)).toEqual([]);
  });
});

describe('PiholeApiService.addAdlist', () => {
  it('posts with correct params', async () => {
    const { mockPost } = mockCreate({ success: true });
    await PiholeApiService.addAdlist(inst as PiholeInstance, 'https://new.list/hosts.txt', 'My list');
    expect(mockPost).toHaveBeenCalledWith('/admin/api.php', null, {
      params: { list: 'adlist', add: 'https://new.list/hosts.txt', comment: 'My list' },
    });
  });

  it('throws when success=false', async () => {
    mockCreate({}, { success: false, message: 'Already exists' });
    await expect(PiholeApiService.addAdlist(inst as PiholeInstance, 'http://dupe.com', '')).rejects.toThrow('Already exists');
  });
});

describe('PiholeApiService.removeAdlist', () => {
  it('posts with sub param', async () => {
    const { mockPost } = mockCreate({ success: true });
    await PiholeApiService.removeAdlist(inst as PiholeInstance, 'https://old.list/hosts.txt');
    expect(mockPost).toHaveBeenCalledWith('/admin/api.php', null, {
      params: { list: 'adlist', sub: 'https://old.list/hosts.txt' },
    });
  });
});

describe('PiholeApiService.getList', () => {
  it('fetches blacklist', async () => {
    mockCreate({ data: [{ id: 1, domain: 'evil.com', enabled: 1, comment: '' }] });
    const result = await PiholeApiService.getList(inst as PiholeInstance, 'black');
    expect(result[0].domain).toBe('evil.com');
  });
});

describe('PiholeApiService.addToList', () => {
  it('adds domain to whitelist', async () => {
    const { mockPost } = mockCreate({ success: true });
    await PiholeApiService.addToList(inst as PiholeInstance, 'white', 'safe.example.com', 'always allow');
    expect(mockPost).toHaveBeenCalledWith('/admin/api.php', null, {
      params: { list: 'white', add: 'safe.example.com', comment: 'always allow' },
    });
  });
});

describe('PiholeApiService.removeFromList', () => {
  it('removes domain from blacklist', async () => {
    const { mockPost } = mockCreate({ success: true });
    await PiholeApiService.removeFromList(inst as PiholeInstance, 'black', 'bad.com');
    expect(mockPost).toHaveBeenCalledWith('/admin/api.php', null, {
      params: { list: 'black', sub: 'bad.com' },
    });
  });
});

describe('PiholeApiService.testConnection', () => {
  it('returns ok=true on valid response', async () => {
    mockCreate({ status: 'enabled', dns_queries_today: 0, ads_blocked_today: 0, ads_percentage_today: 0, domains_being_blocked: 0, unique_clients: 0 });
    const r = await PiholeApiService.testConnection(inst as PiholeInstance);
    expect(r.ok).toBe(true);
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns ok=false when response has no status field', async () => {
    mockCreate({ something: 'else' });
    const r = await PiholeApiService.testConnection(inst as PiholeInstance);
    expect(r.ok).toBe(false);
  });

  it('returns ok=false on network error', async () => {
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      interceptors: { request: { use: vi.fn((fn: unknown) => fn) } },
    } as never);
    const r = await PiholeApiService.testConnection(inst as PiholeInstance);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('ECONNREFUSED');
  });
});

describe('PiholeApiService.formatUptime', () => {
  it('formats days hours minutes', () => expect(PiholeApiService.formatUptime(90061)).toBe('1d 1h 1m'));
  it('formats only minutes',       () => expect(PiholeApiService.formatUptime(300)).toBe('5m'));
  it('returns <1m for tiny values', () => expect(PiholeApiService.formatUptime(30)).toBe('<1m'));
  it('returns null for null',       () => expect(PiholeApiService.formatUptime(null)).toBeNull());
});

describe('PiholeApiService.getVersions', () => {
  it('returns version data', async () => {
    mockCreate({ core_current: 'v5.17.1', FTL_current: 'v5.23', web_current: 'v5.20.1' });
    const r = await PiholeApiService.getVersions(inst as PiholeInstance);
    expect(r.core_current).toBe('v5.17.1');
  });
});

describe('PiholeApiService.getOverTimeData', () => {
  it('returns domains and ads', async () => {
    const payload = { domains_over_time: { '1700000000': 42 }, ads_over_time: { '1700000000': 5 } };
    mockCreate(payload);
    const r = await PiholeApiService.getOverTimeData(inst as PiholeInstance);
    expect(r.domains).toEqual(payload.domains_over_time);
  });

  it('returns empty objects when absent', async () => {
    mockCreate({});
    const r = await PiholeApiService.getOverTimeData(inst as PiholeInstance);
    expect(r.domains).toEqual({});
  });
});

describe('errorMessage', () => {
  it('extracts nested error message',        () => expect(errorMessage({ response: { data: { error: { message: 'Unauthorized' } } } })).toBe('Unauthorized'));
  it('extracts top-level data message',      () => expect(errorMessage({ response: { data: { message: 'Not found' } } })).toBe('Not found'));
  it('falls back to err.message',            () => expect(errorMessage(new Error('went wrong'))).toBe('went wrong'));
  it('returns Unknown error as last resort', () => expect(errorMessage(null)).toBe('Unknown error'));
});
