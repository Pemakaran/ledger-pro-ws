import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CONVERSATION_TYPES } from '@chat/enums/conversation-type.enum';

export const createConversationSchema = z.object({
  type: z.enum(CONVERSATION_TYPES),
  title: z.string().min(1).max(120).optional(),
  referenceId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).min(1),
});

export class CreateConversationDto extends createZodDto(
  createConversationSchema,
) {}

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
