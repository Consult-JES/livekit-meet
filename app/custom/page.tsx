import { redirect } from 'next/navigation';

/**
 * Accredit lockdown: the upstream "custom" entry let anyone connect to an
 * arbitrary LiveKit server with a pasted token. Accredit Meet only serves
 * gateway-launched rooms, so this standalone path is disabled — send users home.
 */
export default function CustomRoomConnection() {
  redirect('/');
}
