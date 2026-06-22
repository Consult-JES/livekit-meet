'use client';

import * as React from 'react';
import { useIsRecording, useRemoteParticipants, useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import toast from 'react-hot-toast';
import { createHostClient } from './hostActions';

/**
 * In-call host moderation panel (Accredit gateway integration).
 *
 * Rendered only when the launch fragment carried a `host_token` (i.e. the
 * gateway minted this participant as the host). All actions are gateway calls
 * (see lib/hostActions.ts):
 *  - admit / deny waiting-room participants
 *  - start / stop recording
 *  - end the meeting for everyone
 *
 * A "waiting" participant is one the gateway has not yet granted publish rights
 * to (waiting_room enabled) — detected client-side as a remote participant with
 * `permissions.canPublish === false`. Admitting flips those grants in place.
 */
export function HostControls(props: { hostCallback: string; hostToken: string }) {
  const client = React.useMemo(
    () => createHostClient(props.hostCallback, props.hostToken),
    [props.hostCallback, props.hostToken],
  );
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const isRecording = useIsRecording(room);

  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [recordingSupported, setRecordingSupported] = React.useState(true);
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);

  // Permission flips (admit) don't change the participant list, so re-render on
  // them explicitly to keep the waiting list current.
  React.useEffect(() => {
    const bump = () => forceTick();
    room.on(RoomEvent.ParticipantPermissionsChanged, bump);
    return () => {
      room.off(RoomEvent.ParticipantPermissionsChanged, bump);
    };
  }, [room]);

  const waiting = remoteParticipants.filter((p) => p.permissions?.canPublish === false);

  const handleExpired = () => toast.error('Host session expired — relaunch the meeting from Accredit.');

  const admit = async (identity: string, label: string) => {
    setBusy(`admit:${identity}`);
    const r = await client.admit(identity);
    setBusy(null);
    if (r.ok) toast.success(`Admitted ${label}`);
    else if (r.expired) handleExpired();
    else toast.error(`Could not admit ${label}`);
  };

  const deny = async (identity: string, label: string) => {
    setBusy(`deny:${identity}`);
    const r = await client.deny(identity);
    setBusy(null);
    if (r.ok) toast.success(`Removed ${label}`);
    else if (r.expired) handleExpired();
    else toast.error(`Could not remove ${label}`);
  };

  const toggleRecording = async () => {
    setBusy('recording');
    const r = isRecording ? await client.stopRecording() : await client.startRecording();
    setBusy(null);
    if (r.unsupported) {
      setRecordingSupported(false);
      toast.error('Recording is not available for this meeting.');
      return;
    }
    if (r.ok) toast.success(isRecording ? 'Recording stopped' : 'Recording started');
    else if (r.expired) handleExpired();
    else if (r.status === 409) toast('No active recording.');
    else toast.error('Could not change recording.');
  };

  const endMeeting = async () => {
    if (!window.confirm('End the meeting for everyone? All participants will be disconnected.')) {
      return;
    }
    setBusy('end');
    const r = await client.endMeeting();
    setBusy(null);
    // On success the gateway deletes the room; LiveKit fires Disconnected, which
    // drives the leave/return-url navigation. Only surface failures here.
    if (!r.ok) {
      if (r.expired) handleExpired();
      else toast.error('Could not end the meeting.');
    }
  };

  const nameOf = (p: { name?: string; identity: string }) => p.name || p.identity;

  return (
    <div className="lk-host-controls" style={panelWrap}>
      <button
        type="button"
        className="lk-button"
        style={toggleBtn}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Host
        {waiting.length > 0 && <span style={badge}>{waiting.length}</span>}
      </button>

      {open && (
        <div style={panel} role="dialog" aria-label="Host controls">
          <div style={section}>
            <div style={sectionTitle}>
              Waiting room{waiting.length > 0 ? ` (${waiting.length})` : ''}
            </div>
            {waiting.length === 0 ? (
              <p style={muted}>No one is waiting.</p>
            ) : (
              <ul style={list}>
                {waiting.map((p) => (
                  <li key={p.identity} style={row}>
                    <span style={rowName} title={nameOf(p)}>
                      {nameOf(p)}
                    </span>
                    <span style={rowActions}>
                      <button
                        type="button"
                        className="lk-button"
                        style={admitBtn}
                        disabled={busy === `admit:${p.identity}`}
                        onClick={() => admit(p.identity, nameOf(p))}
                      >
                        Admit
                      </button>
                      <button
                        type="button"
                        className="lk-button"
                        style={denyBtn}
                        disabled={busy === `deny:${p.identity}`}
                        onClick={() => deny(p.identity, nameOf(p))}
                      >
                        Deny
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={section}>
            <div style={sectionTitle}>Meeting</div>
            {recordingSupported && (
              <button
                type="button"
                className="lk-button"
                style={fullBtn}
                disabled={busy === 'recording'}
                onClick={toggleRecording}
              >
                {isRecording ? '■ Stop recording' : '● Start recording'}
              </button>
            )}
            <button
              type="button"
              className="lk-button"
              style={{ ...fullBtn, ...endBtn }}
              disabled={busy === 'end'}
              onClick={endMeeting}
            >
              End meeting for all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- inline styles (self-contained, dark theme + Accredit indigo) ---
const ACCENT = '#818cf8';
const panelWrap: React.CSSProperties = {
  position: 'absolute',
  top: '0.75rem',
  right: '0.75rem',
  zIndex: 20,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.5rem',
};
const toggleBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'rgba(15, 23, 42, 0.85)',
  border: `1px solid ${ACCENT}`,
  color: '#f1f5f9',
};
const badge: React.CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  minWidth: '1.25rem',
  height: '1.25rem',
  padding: '0 0.35rem',
  borderRadius: '999px',
  background: ACCENT,
  color: '#1e1b4b',
  fontSize: '0.75rem',
  fontWeight: 700,
};
const panel: React.CSSProperties = {
  width: '18rem',
  maxWidth: '80vw',
  padding: '0.75rem',
  borderRadius: '0.5rem',
  background: 'rgba(15, 23, 42, 0.96)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
  color: '#f1f5f9',
  backdropFilter: 'blur(4px)',
};
const section: React.CSSProperties = { paddingBlock: '0.5rem' };
const sectionTitle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'rgba(241,245,249,0.55)',
  marginBottom: '0.5rem',
};
const muted: React.CSSProperties = { margin: 0, fontSize: '0.85rem', color: 'rgba(241,245,249,0.5)' };
const list: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' };
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
};
const rowName: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '0.9rem',
};
const rowActions: React.CSSProperties = { display: 'flex', gap: '0.3rem', flexShrink: 0 };
const admitBtn: React.CSSProperties = { background: ACCENT, color: '#1e1b4b', padding: '0.3rem 0.6rem' };
const denyBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.25)',
  padding: '0.3rem 0.6rem',
};
const fullBtn: React.CSSProperties = { width: '100%', marginTop: '0.4rem' };
const endBtn: React.CSSProperties = { background: '#b91c1c', color: '#fff', border: 'none' };
