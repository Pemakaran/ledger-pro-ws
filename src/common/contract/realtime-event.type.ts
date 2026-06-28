/**
 * The inter-service contract between the LedgerPro backend (publisher) and this
 * realtime service (subscriber). The backend PUBLISHes a `RealtimeEnvelope` as
 * JSON on REALTIME_CHANNEL; the subscriber maps `target` to a socket.io room
 * and emits `event` with `payload` on `namespace`.
 *
 * Keep this file byte-identical with the backend's copy — a mismatch silently
 * drops events. A contract test asserts the shape on both sides.
 */

export const REALTIME_CHANNEL = 'ledgerpro:realtime';

export type RealtimeNamespace = '/notifications' | '/chat';

export type RealtimeTarget =
  | { type: 'user'; id: string }
  | { type: 'branch'; id: string }
  | { type: 'group'; id: string }
  | { type: 'broadcast' };

export interface RealtimeEnvelope {
  /** Schema version — bump on a breaking change to the envelope. */
  v: 1;
  target: RealtimeTarget;
  namespace: RealtimeNamespace;
  event: string;
  payload: unknown;
}

/** Maps an envelope target to its socket.io room name (null = whole namespace). */
export function targetRoom(target: RealtimeTarget): string | null {
  switch (target.type) {
    case 'user':
      return `user:${target.id}`;
    case 'branch':
      return `branch:${target.id}`;
    case 'group':
      return `group:${target.id}`;
    case 'broadcast':
      return null;
  }
}
