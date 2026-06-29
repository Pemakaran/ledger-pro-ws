import { z } from 'zod';

/**
 * The inter-service contract between the LedgerPro backend (publisher) and this
 * realtime service (subscriber). The backend PUBLISHes a `RealtimeEnvelope` as
 * JSON on REALTIME_CHANNEL; the subscriber maps `target` to a socket.io room
 * and emits `event` with `payload` on `namespace`.
 *
 * The backend keeps a plain-types copy of this shape — it is the trusted
 * publisher. This service is the subscriber, so it validates the SAME contract
 * at runtime via these Zod schemas. The static types are derived with `z.infer`
 * (no parallel hand-written interface); the spec is the guard against drift.
 */
export const REALTIME_CHANNEL = 'ledgerpro:realtime';
export const REALTIME_NAMESPACES = ['/notifications', '/chat'] as const;

export const realtimeTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user'), id: z.string() }),
  z.object({ type: z.literal('branch'), id: z.string() }),
  z.object({ type: z.literal('group'), id: z.string() }),
  z.object({ type: z.literal('broadcast') }),
]);

export const realtimeEnvelopeSchema = z.object({
  /** Schema version — bump on a breaking change to the envelope. */
  v: z.literal(1),
  target: realtimeTargetSchema,
  namespace: z.enum(REALTIME_NAMESPACES),
  event: z.string().min(1),
  payload: z.unknown(),
});

export type RealtimeTarget = z.infer<typeof realtimeTargetSchema>;
export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;
export type RealtimeNamespace = (typeof REALTIME_NAMESPACES)[number];

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
