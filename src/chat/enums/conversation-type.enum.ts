/**
 * Kind of conversation:
 *  - `direct`  — 1:1 (staff↔staff DM, or customer↔staff support thread)
 *  - `group`   — a customer-group's shared chat (referenceId → group id)
 *  - `support` — a customer↔staff support inbox thread
 * Stored as varchar; the allowed set is enforced at the edge by Zod.
 */
export const CONVERSATION_TYPES = ['direct', 'group', 'support'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];
