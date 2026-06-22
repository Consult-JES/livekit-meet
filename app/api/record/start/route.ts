import { NextResponse } from 'next/server';

/**
 * Accredit lockdown: upstream's standalone recording route is unauthenticated
 * ("DO NOT USE THIS FOR PRODUCTION PURPOSES AS IS") and lets anyone with a
 * roomName start an egress. Accredit Meet controls recording through the
 * conferencing-gateway host actions (POST {host_callback}/start_recording with
 * a host token — see lib/HostControls.tsx), so this route is disabled here.
 */
export function GET() {
  return new NextResponse('Recording is controlled by the meeting host via Accredit.', {
    status: 403,
  });
}
