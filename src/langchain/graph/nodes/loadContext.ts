import { Command } from '@langchain/langgraph';
import { GraphState } from '../state.js';
import { MemoryRepository } from '../../../memory/MemoryRepository.js';
import { buildContext } from '../../../memory/ContextBuilder.js';
import { initialSystemMessage } from '../../prompt.js';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { NODE_MODEL } from '../../../utils/constants.js';

export async function loadContext(state: GraphState): Promise<Command> {
  const messages = await prepareMessages(state);
  return new Command({
    goto: NODE_MODEL,
    update: {
      ...state,
      messages: messages,
    },
  });
}

async function prepareMessages(graphInput: GraphState) {
  const memory = new MemoryRepository();
  const recent = await memory.recent(graphInput.userId, 6);
  const ctx = buildContext(recent);
  const sys = initialSystemMessage(graphInput.userName, graphInput.lang);
  return [
    new SystemMessage(sys),
    new HumanMessage(`${graphInput.input}\n\nContexto:\n${ctx}`),
  ];
}
