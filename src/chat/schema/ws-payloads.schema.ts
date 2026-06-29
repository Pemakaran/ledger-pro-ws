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

/** Inbound `chat:edit` payload — replace a message's text. */
export const chatEditPayloadSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});
export type ChatEditPayload = z.infer<typeof chatEditPayloadSchema>;

/** Inbound /chat payload identifying a single message (delete). */
export const messageRefSchema = z.object({
  messageId: z.string().uuid(),
});
export type MessageRef = z.infer<typeof messageRefSchema>;
