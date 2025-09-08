import { Firestore } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeFirestoreQueryTool } from '../tools/firestoreQueryTool.js';
import { UserProfileRepository } from '../../memory/UserProfileRepository.js';
import { MemoryRepository } from '../../memory/MemoryRepository.js';
import { buildContext } from '../../memory/ContextBuilder.js';
import { initialSystemMessage } from '../prompt.js';
import { makeTransactionTypesTool } from '../tools/transactionTypesTool.js';
import { makeTransactionCategoriesTool } from '../tools/transactionCategoriesTool.js';
import { Runnable } from '@langchain/core/runnables';

export interface GraphInput {
  userId: string;
  input: string;
}

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

export async function prepareMessages(graphInput: GraphInput) {
  const profiles = new UserProfileRepository();
  const memory = new MemoryRepository();
  const profile = await profiles.get(graphInput.userId);
  const lang = profile.language || 'es';
  const name = profile.name || 'Usuario';
  const recent = await memory.recent(graphInput.userId, 6);
  const ctx = buildContext(recent);
  const sys = initialSystemMessage(name, lang);
  return [
    new SystemMessage(sys),
    new HumanMessage(`${graphInput.input}\n\nContexto:\n${ctx}`),
  ];
}
