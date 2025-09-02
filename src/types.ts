import { z } from 'zod';

export const ChatMessage = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

export const ChatRequest = z.object({
  messages: z.array(ChatMessage).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional()
});

export type TChatRequest = z.infer<typeof ChatRequest>;
