import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Query string for paginated history — coerced from strings. */
export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.date().optional(),
});

export class HistoryQueryDto extends createZodDto(historyQuerySchema) {}

export type HistoryQuery = z.infer<typeof historyQuerySchema>;
