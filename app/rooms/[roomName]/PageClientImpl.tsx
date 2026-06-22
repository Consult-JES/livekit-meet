'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { HostControls } from '@/lib/HostControls';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  RoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import {
  parseLaunchFragment,
  isRedirectLaunch,
  participantNameFromToken,
  type LaunchParams,
} from '@/lib/launch';

const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';

type LaunchState = 'pending' | 'invalid' | 'ready';

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [launch, setLaunch] = React.useState<LaunchParams | undefined>(undefined);

  // Accredit gateway launch: the conferencing-gateway bakes the LiveKit JWT +
  // ws_url (or a Zoom redirect) into the URL fragment. Accredit Meet ONLY serves
  // gateway-launched rooms — there is no standalone PreJoin/demo path. A missing
  // or malformed fragment yields a branded "invalid link" screen rather than an
  // unauthenticated join form. The fragment is client-only, so detect on mount.
  const [launchState, setLaunchState] = React.useState<LaunchState>('pending');
  React.useEffect(() => {
    const parsed = parseLaunchFragment();
    if (!parsed) {
      setLaunchState('invalid');
      return;
    }
    if (isRedirectLaunch(parsed)) {
      window.location.href = parsed.joinUrl;
      return; // redirecting to the provider (Zoom); don't mount the room
    }
    const username = participantNameFromToken(parsed.accessToken) ?? '';
    setLaunch(parsed);
    setConnectionDetails({
      serverUrl: parsed.wsUrl,
      participantToken: parsed.accessToken,
      roomName: props.roomName,
      participantName: username,
    });
    setPreJoinChoices({
      username,
      videoEnabled: true,
      audioEnabled: true,
      videoDeviceId: '',
      audioDeviceId: '',
    });
    setLaunchState('ready');
  }, [props.roomName]);

  if (connectionDetails === undefined || preJoinChoices === undefined) {
    return (
      <main data-lk-theme="default" style={{ height: '100%' }}>
        {launchState === 'invalid' ? <InvalidLaunch /> : null}
      </main>
    );
  }

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      <VideoConferenceComponent
        connectionDetails={connectionDetails}
        userChoices={preJoinChoices}
        returnUrl={launch?.returnUrl}
        hostToken={launch?.hostToken}
        hostCallback={launch?.hostCallback}
        options={{
          codec: props.codec,
          hq: props.hq,
          singlePeerConnection: props.singlePeerConnection,
        }}
      />
    </main>
  );
}

function InvalidLaunch() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        height: '100%',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <img
        src="/images/accredit-mark.svg"
        alt="Accredit"
        width="64"
        height="64"
        style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
      />
      <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#f1f5f9' }}>
        This meeting link isn&rsquo;t valid
      </h1>
      <p style={{ margin: 0, maxWidth: '28rem', lineHeight: 1.6, color: 'rgba(241,245,249,0.6)' }}>
        The link may have expired or been opened directly. Please rejoin the session from your
        Accredit course or event.
      </p>
    </div>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  returnUrl?: string;
  hostToken?: string;
  hostCallback?: string;
  options: {
    hq: boolean;
    codec: VideoCodec;
    singlePeerConnection: boolean;
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: false,
      videoSimulcastLayers: props.options.hq
        ? [VideoPresets.h1080, VideoPresets.h720]
        : [VideoPresets.h540, VideoPresets.h216],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: props.options.singlePeerConnection,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => {
    // Return the user to the launching course/event when the gateway provided a
    // return_url; otherwise fall back to the branded landing.
    if (props.returnUrl) {
      window.location.href = props.returnUrl;
    } else {
      router.push('/');
    }
  }, [router, props.returnUrl]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices, handleOnLeave]);

  const lowPowerMode = useLowCPUOptimizer(room);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  const isHost = !!(props.hostToken && props.hostCallback);

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <KeyboardShortcuts />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        {isHost && (
          <HostControls hostToken={props.hostToken!} hostCallback={props.hostCallback!} />
        )}
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}
