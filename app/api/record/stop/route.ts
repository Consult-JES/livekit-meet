import { NextResponse } from 'next/server';

/**
 * Accredit lockdown: see ../start/route.ts. Recording stop is a gateway host
 * action (POST {host_callback}/stop_recording), so this standalone,
 * unauthenticated route is disabled in this deployment.
 */
export function GET() {
  return new NextResponse('Recording is controlled by the meeting host via Accredit.', {
    status: 403,
  });
}
