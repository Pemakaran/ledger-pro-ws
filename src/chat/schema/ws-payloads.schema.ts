import { z } from 'zod';
import { attachmentSchema } from '@chat/schema/attachment.schema';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@chat/chat-attachments.constants';

/** Inbound /chat socket payload identifying a conversation (join/typing/read). */
export const conversationRefSchema = z.object({
  conversationId: z.string().uuid(),
});
export type ConversationRef = z.infer<typeof conversationRefSchema>;

/** Inbound `chat:message` payload — text and/or up to N attachments. */
export const chatMessagePayloadSchema = conversationRefSchema.extend({
  body: z.string().max(4000).default(''),
  attachments: z
    .array(attachmentSchema)
    .max(MAX_ATTACHMENTS_PER_MESSAGE)
    .optional(),
});
export type ChatMessagePayload = z.infer<typeof chatMessagePayloadSchema>;
