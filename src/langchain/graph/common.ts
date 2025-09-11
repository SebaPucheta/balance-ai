import { Firestore } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import { makeFirestoreQueryTool } from '../tools/firestoreQueryTool.js';
import { makeTransactionTypesTool } from '../tools/transactionTypesTool.js';
import { makeTransactionCategoriesTool } from '../tools/transactionCategoriesTool.js';
import { Runnable } from '@langchain/core/runnables';

function supportsSamplingParams(model?: string) {
  const m = (model || '').toLowerCase();
  return !m.includes('gpt-5-nano');
}

export function buildModel(): ChatOpenAI {
  const modelName = process.env.OPENAI_MODEL || 'gpt-5-nano';
  return new ChatOpenAI({
    model: modelName,
    ...(supportsSamplingParams(modelName) ? { temperature: 0.2 } : {})
  });
}

export function buildTools(firestore: Firestore): Runnable<any, any>[] {
  return [
    makeFirestoreQueryTool(firestore),
    makeTransactionCategoriesTool(firestore),
    makeTransactionTypesTool(firestore),
  ];
}
