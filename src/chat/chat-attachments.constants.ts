/**
 * Attachment policy — the single source of truth shared with the backend upload
 * endpoint (which mirrors these in its ParseFilePipe). The realtime Zod schema
 * must accept exactly what the backend accepts, so a client can never upload a
 * file the backend allowed but chat then rejects (or vice-versa).
 *
 * v1 set: images (inline preview) + PDF + common Office documents (file chips).
 */
export const CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

export type ChatAttachmentMimeType =
  (typeof CHAT_ATTACHMENT_MIME_TYPES)[number];

/** 15 MB — covers a high-res photo or a sizeable PDF/spreadsheet. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
