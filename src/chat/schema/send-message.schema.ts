import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { attachmentSchema } from '@chat/schema/attachment.schema';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@chat/chat-attachments.constants';

/**
 * A message carries text and/or attachments. `body` may be empty when there are
 * attachments (an image-only message); the service rejects a fully empty send.
 */
export const sendMessageSchema = z.object({
  body: z.string().max(4000).default(''),
  attachments: z
    .array(attachmentSchema)
    .max(MAX_ATTACHMENTS_PER_MESSAGE)
    .optional(),
});

export class SendMessageDto extends createZodDto(sendMessageSchema) {}

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
