import { Firestore } from '@google-cloud/firestore';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { makeFirestoreQueryTool } from './tools/firestoreQueryTool.js';
import { UserProfileRepository } from '../memory/UserProfileRepository.js';
import { MemoryRepository } from '../memory/MemoryRepository.js';
import { buildContext } from '../memory/ContextBuilder.js';
import { initialSystemMessage } from './prompt.js';
import { makeTransactionTypesTool } from './tools/transactionTypesTool.js';
import { makeTransactionCategoriesTool } from './tools/transactionCategoriesTool.js';

const MAX_ROUND = 6;

export interface ChainInput {
  userId: string;
  input: string;
}

function supportsSamplingParams(model?: string) {
  const m = (model || '').toLowerCase();
  return !m.includes('gpt-5-nano');
}

export async function buildChain(firestore: Firestore) {
  const modelName = process.env.OPENAI_MODEL || 'gpt-5-nano';
  const model = new ChatOpenAI({
    model: modelName,
    ...(supportsSamplingParams(modelName) ? { temperature: 0.2 } : {})
  });

  const queryTool = makeFirestoreQueryTool(firestore);
  const transactionTypesTool = makeTransactionTypesTool(firestore);
  const transactionCategoriesTool = makeTransactionCategoriesTool(firestore);
  const tooled = model.bindTools([
    queryTool,
    transactionCategoriesTool,
    transactionTypesTool,
  ]);
  const profiles = new UserProfileRepository();
  const memory = new MemoryRepository();

  async function prep(chainInput: ChainInput) {
    const profile = await profiles.get(chainInput.userId);
    const lang = profile.language || 'es';
    const name = profile.name || 'Usuario';
    const recent = await memory.recent(chainInput.userId, 6);
    const ctx = buildContext(recent);
    const sys = initialSystemMessage(name, lang);
    return { sys, userText: `${chainInput.input}\n\nContexto:\n${ctx}` };
  }

  const run = async (chainInput: ChainInput): Promise<string> => {
    const { sys, userText } = await prep(chainInput);

    // We build the history as LangChain message objects
    const messages = [
      new SystemMessage(sys),
      new HumanMessage(userText),
    ];

    for (let hops = 0; hops < MAX_ROUND; hops++) {
      // 1) Call the model (with tools enabled)
      const ai = await tooled.invoke(messages);

      // Did the model request tool-calls?
      const toolCalls = ai?.additional_kwargs?.tool_calls;
      if (Array.isArray(toolCalls) && toolCalls.length) {
        // We save the AIMessage "with tool_calls" in the history
        messages.push(new AIMessage({
          content: ai.content ?? "",
          additional_kwargs: ai.additional_kwargs, // necessary to preserve tool_call_id
        }));

        // We execute each tool and add ToolMessage(s)
        for (const call of toolCalls) {
          const name = call.function?.name;
          const argsStr = call.function?.arguments ?? "{}";
          let args: any = {};
          try {
            args = JSON.parse(argsStr);
          } catch {
            // ignore
          }
          let result: any;
          if (name === queryTool.name) {
            // DynamicStructuredTool is runnable: invoke(args)
            result = await queryTool.invoke(args);
          } else {
            result = { error: `Unknown tool: ${name}` };
          }
          // We add a ToolMessage with the same tool_call_id that the model returned
          messages.push(new ToolMessage({
            content: typeof result === 'string' ? result : JSON.stringify(result),
            tool_call_id: call.id,
          }));
        }

        // the loop continues: the next hop will make another model call
        continue;
      }

      // There were no tool-calls: this AIMessage is the final answer
      const text = (typeof ai?.content === 'string') ? ai.content.trim() : '';
      return text || 'Perdón, no pude generar una respuesta en este momento.';
    }

    // If we exit for security reasons (too many hops) and there was no final answer
    return 'Necesito un poco más de contexto o permiso para usar herramientas y completar tu pedido.';
  };

  return { run };
}