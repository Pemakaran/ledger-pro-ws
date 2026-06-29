import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});

export class SendMessageDto extends createZodDto(sendMessageSchema) {}

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
