import { NextResponse } from 'next/server';

/**
 * Accredit lockdown: upstream LiveKit Meet exposed this route to mint a room
 * token for ANY roomName with no authentication (the standalone PreJoin/demo
 * flow). Accredit Meet never self-mints — the conferencing-gateway issues the
 * LiveKit JWT and delivers it in the launch-URL fragment (see lib/launch.ts).
 * This endpoint is therefore disabled in this deployment.
 */
export function GET() {
  return new NextResponse('Not available. Join your meeting from your Accredit course or event.', {
    status: 403,
  });
}
