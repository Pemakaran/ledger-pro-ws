import { z } from 'zod';

/**
 * Inbound `/notifications` payload to join or leave a customer-group's live
 * room (`group:<id>`), where the backend broadcasts `group-cart:changed`.
 */
export const groupRoomSchema = z.object({
  groupId: z.string().uuid(),
});
export type GroupRoomRef = z.infer<typeof groupRoomSchema>;
