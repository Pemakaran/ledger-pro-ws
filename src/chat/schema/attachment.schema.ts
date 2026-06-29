import { z } from 'zod';
import {
  CHAT_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from '@chat/chat-attachments.constants';

/**
 * One attachment as the client reports it after uploading to the backend.
 * `url`/`publicId` come from Cloudinary; the realtime service persists the
 * metadata. The MIME allowlist + size cap mirror the backend upload endpoint
 * exactly (see chat-attachments.constants), so the two edges can't disagree.
 */
export const attachmentSchema = z.object({
  url: z.string().url().startsWith('https://'),
  publicId: z.string().min(1).max(255),
  mimeType: z.enum(CHAT_ATTACHMENT_MIME_TYPES),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type AttachmentInput = z.infer<typeof attachmentSchema>;
