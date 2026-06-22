/**
 * Host actions (Accredit gateway integration).
 *
 * For a host launch, the conferencing-gateway puts a short-lived host-action JWT
 * (`host_token`) and a base URL (`host_callback = {gateway}/v1/rooms/{room_uuid}`)
 * into the launch fragment (see lib/launch.ts). Host-only moderation calls are
 * `POST {host_callback}/{action}` with `Authorization: Bearer {host_token}`.
 *
 * Capability gating: the gateway returns 501 when the active provider doesn't
 * support an action (e.g. recording/admit on a non-LiveKit room) — callers use
 * `unsupported` to hide the corresponding control.
 */

export type HostAction =
  | 'admit'
  | 'deny'
  | 'start_recording'
  | 'stop_recording'
  | 'end_meeting'
  | 'participants';

export interface HostActionResult<T = Record<string, unknown>> {
  ok: boolean;
  /** HTTP status, or 0 on a network/transport failure. */
  status: number;
  data?: T;
  /** Provider does not support this action (gateway 501). */
  unsupported: boolean;
  /** Host token rejected/expired (gateway 401). */
  expired: boolean;
}

export interface HostClient {
  admit(identity: string): Promise<HostActionResult>;
  deny(identity: string): Promise<HostActionResult>;
  startRecording(): Promise<HostActionResult<{ egress_id?: string }>>;
  stopRecording(): Promise<HostActionResult>;
  endMeeting(): Promise<HostActionResult>;
}

export function createHostClient(hostCallback: string, hostToken: string): HostClient {
  const base = hostCallback.replace(/\/$/, '');

  async function call<T>(
    action: HostAction,
    body?: Record<string, unknown>,
  ): Promise<HostActionResult<T>> {
    try {
      const resp = await fetch(`${base}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: JSON.stringify(body ?? {}),
      });
      let data: T | undefined;
      try {
        data = (await resp.json()) as T;
      } catch {
        data = undefined;
      }
      return {
        ok: resp.ok,
        status: resp.status,
        data,
        unsupported: resp.status === 501,
        expired: resp.status === 401,
      };
    } catch {
      return { ok: false, status: 0, unsupported: false, expired: false };
    }
  }

  return {
    admit: (identity) => call('admit', { identity }),
    deny: (identity) => call('deny', { identity }),
    startRecording: () => call<{ egress_id?: string }>('start_recording', {}),
    stopRecording: () => call('stop_recording', {}),
    endMeeting: () => call('end_meeting', {}),
  };
}
