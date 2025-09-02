import { MemoryItem } from './MemoryRepository.js';

export function buildContext(items: MemoryItem[], maxChars = 1500): string {
  const lines: string[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const role = it.role === 'user' ? 'User' : 'Assistant';
    lines.push(`${role}: ${it.text}`);
  }
  let ctx = lines.join('\n');
  if (ctx.length > maxChars) ctx = ctx.slice(ctx.length - maxChars);
  return ctx;
}
