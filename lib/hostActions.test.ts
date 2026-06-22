import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHostClient } from './hostActions';

const CALLBACK = 'https://gw.example.com/v1/rooms/room-123';
const TOKEN = 'host.jwt.token';

function mockFetch(status: number, body: unknown = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createHostClient', () => {
  it('POSTs to {callback}/{action} with bearer host token and JSON body', async () => {
    const fetchMock = mockFetch(200, { ok: true });
    const client = createHostClient(CALLBACK, TOKEN);

    await client.admit('lms:user-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CALLBACK}/admit`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ identity: 'lms:user-abc' });
  });

  it('strips a trailing slash from the callback base', async () => {
    const fetchMock = mockFetch(200);
    const client = createHostClient(`${CALLBACK}/`, TOKEN);
    await client.endMeeting();
    expect(fetchMock.mock.calls[0][0]).toBe(`${CALLBACK}/end_meeting`);
  });

  it('flags a 501 as unsupported (capability gate)', async () => {
    mockFetch(501, { detail: 'recording_control is not supported' });
    const client = createHostClient(CALLBACK, TOKEN);
    const r = await client.startRecording();
    expect(r.ok).toBe(false);
    expect(r.unsupported).toBe(true);
    expect(r.expired).toBe(false);
  });

  it('flags a 401 as expired (host token rejected)', async () => {
    mockFetch(401, 'invalid host token');
    const client = createHostClient(CALLBACK, TOKEN);
    const r = await client.deny('lms:user-x');
    expect(r.ok).toBe(false);
    expect(r.expired).toBe(true);
  });

  it('surfaces a 409 (no active recording) without ok/unsupported/expired', async () => {
    mockFetch(409, 'no active recording');
    const client = createHostClient(CALLBACK, TOKEN);
    const r = await client.stopRecording();
    expect(r.ok).toBe(false);
    expect(r.status).toBe(409);
    expect(r.unsupported).toBe(false);
    expect(r.expired).toBe(false);
  });

  it('returns status 0 on a network failure (no throw)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const client = createHostClient(CALLBACK, TOKEN);
    const r = await client.admit('lms:user-y');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
  });

  it('passes through start_recording egress_id payload', async () => {
    mockFetch(200, { ok: true, egress_id: 'EG_123' });
    const client = createHostClient(CALLBACK, TOKEN);
    const r = await client.startRecording();
    expect(r.ok).toBe(true);
    expect(r.data?.egress_id).toBe('EG_123');
  });
});
