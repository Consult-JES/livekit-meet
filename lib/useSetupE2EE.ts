import React from 'react';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { decodePassphrase } from './client-utils';
import { parseLaunchFragment } from './launch';

export function useSetupE2EE() {
  // A gateway launch fragment (access_token=… / provider=…) is NOT an E2EE
  // passphrase — bail so we don't derive a bogus key from it and break media.
  const isLaunch = typeof window !== 'undefined' && parseLaunchFragment() !== null;
  const e2eePassphrase =
    typeof window !== 'undefined' && !isLaunch
      ? decodePassphrase(location.hash.substring(1))
      : undefined;

  const worker: Worker | undefined =
    typeof window !== 'undefined' && e2eePassphrase
      ? new Worker(new URL('livekit-client/e2ee-worker', import.meta.url))
      : undefined;

  return { worker, e2eePassphrase };
}
