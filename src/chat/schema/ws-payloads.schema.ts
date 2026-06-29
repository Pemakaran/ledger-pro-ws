import { z } from 'zod';

/** Inbound /chat socket payload identifying a conversation (join/typing/read). */
export const conversationRefSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ConversationRef = z.infer<typeof conversationRefSchema>;

/** Inbound `chat:message` payload. */
export const chatMessagePayloadSchema = conversationRefSchema.extend({
  body: z.string().min(1).max(4000),
});
export type ChatMessagePayload = z.infer<typeof chatMessagePayloadSchema>;
