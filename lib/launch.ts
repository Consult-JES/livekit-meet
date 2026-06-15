/**
 * Launch-fragment parsing (Accredit gateway integration).
 *
 * meet-web does NOT mint LiveKit JWTs itself — that is the job of the
 * conferencing-gateway service. A launching platform (LMS, events, …) directs
 * the user to:
 *
 *     meet.{domain}/rooms/<room_name>#access_token=<jwt>&ws_url=<wss>
 *
 * The token lives in the URL fragment so it never reaches any HTTP server log.
 * This helper extracts and validates the shape of those parameters. A launch
 * fragment is distinguished from an E2EE passphrase fragment by the literal
 * substring `access_token=` (LiveKit) or `provider=` (redirect providers).
 */

export type LaunchProvider = 'livekit' | 'zoom';

export interface LaunchParams {
  provider: LaunchProvider;
  /** Redirect-provider (Zoom) join URL; absent on the LiveKit path. */
  joinUrl?: string;
  /** Pre-minted LiveKit JWT (identity + grants + metadata). LiveKit path only. */
  accessToken: string;
  /** LiveKit WebSocket URL. LiveKit path only. */
  wsUrl: string;
  /** Where to send the user after the call ends (LMS lobby / event page). */
  returnUrl?: string;
  /** Host-action JWT (only for hosts). */
  hostToken?: string;
  /** Gateway room-action base URL ({gateway}/v1/rooms/{room_uuid}). */
  hostCallback?: string;
  /** Gateway room_uuid. */
  roomUuid?: string;
}

/** Decode a JWT payload without verifying (LiveKit verifies server-side). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** True when a launch hands off to an external provider by redirect (Zoom). */
export function isRedirectLaunch(
  launch: LaunchParams | null,
): launch is LaunchParams & { joinUrl: string } {
  return !!launch && launch.provider !== 'livekit' && !!launch.joinUrl;
}

/**
 * Read launch parameters from `window.location.hash`, or null when the
 * fragment is empty / an E2EE passphrase / missing required fields.
 */
export function parseLaunchFragment(): LaunchParams | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.slice(1);
  if (!hash || (!hash.includes('access_token=') && !hash.includes('provider='))) {
    return null;
  }

  const params = new URLSearchParams(hash);
  const providerRaw = params.get('provider');
  const provider: LaunchProvider = providerRaw === 'zoom' ? 'zoom' : 'livekit';

  const returnUrl = params.get('return_url') ?? undefined;
  const hostToken = params.get('host_token') ?? undefined;
  const hostCallback = params.get('host_callback') ?? undefined;
  const roomUuid = params.get('room_uuid') ?? undefined;

  if (provider !== 'livekit') {
    const joinUrl = params.get('join_url') ?? undefined;
    if (!joinUrl) return null;
    return { provider, joinUrl, accessToken: '', wsUrl: '', returnUrl, hostToken, hostCallback, roomUuid };
  }

  const accessToken = params.get('access_token');
  const wsUrl = params.get('ws_url');
  if (!accessToken || !wsUrl) return null;

  return { provider, accessToken, wsUrl, returnUrl, hostToken, hostCallback, roomUuid };
}

/** Best-effort participant name from a launch JWT's `name` claim. */
export function participantNameFromToken(token: string): string | undefined {
  const payload = decodeJwtPayload(token);
  const name = payload?.['name'];
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}
