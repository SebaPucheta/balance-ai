import { Firestore } from '@google-cloud/firestore';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { normalizeName, similarity } from './helper';

// ---------- Tool: listar tipos ----------
export function makeTransactionTypesTool(firestore: Firestore) {
  return new DynamicStructuredTool({
    name: 'list_transaction_types',
    description:
      "Get all documents from 'transactionTypes' with {id,name}. If 'query' is provided, returns fuzzy matches to help validate user typos.",
    schema: z.object({
      query: z.string().optional(),
      topK: z.number().int().positive().max(50).default(5)
    }),
    async func(args) {
      const snap = await firestore.collection('transactionTypes').get();
      const items = snap.docs
        .map(d => {
          const id = (d.get('id') ?? d.id) as string;
          const name = String(d.get('name') ?? '').trim();
          return name ? { id, name } : null;
        })
        .filter(Boolean) as Array<{ id: string; name: string }>;

      if (!args.query) {
        return JSON.stringify({ items, count: items.length });
      }

      const qn = normalizeName(args.query);
      const scored = items
        .map(it => ({
          ...it,
          score: similarity(qn, normalizeName(it.name))
        }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0] ?? null;
      const top = scored.slice(0, args.topK).map(({ id, name, score }) => ({ id, name, score }));

      return JSON.stringify({
        items,
        count: items.length,
        match: {
          query: args.query,
          best,
          top
        }
      });
    }
  });
}
