import { z } from 'zod';

/**
 * Dedicated Redis channel for chat CONTROL actions (membership revocation),
 * separate from the passthrough realtime channel — so the dumb relay never sees
 * control traffic and the control consumer never sees passthrough events.
 */
export const CHAT_CONTROL_CHANNEL = 'ledgerpro:chat-control';

/**
 * Backend → realtime control message. `revoke` prunes a member (kind:'user') or
 * every member (kind:'all', on group archive) from a group's chat and kicks
 * their live sockets.
 */
export const chatControlSchema = z.object({
  v: z.literal(1),
  action: z.literal('revoke'),
  groupId: z.string().uuid(),
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('user'), userId: z.string().uuid() }),
    z.object({ kind: z.literal('all') }),
  ]),
});
export type ChatControlMessage = z.infer<typeof chatControlSchema>;
