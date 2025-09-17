import { Command } from '@langchain/langgraph';
import { GraphState } from '../state.js';
import { MemoryRepository } from '../../../memory/MemoryRepository.js';
import { initialSystemMessage } from '../../prompt.js';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
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
  const recentHistory = await memory.recent(graphInput.userId, 6);

  const sys = initialSystemMessage(graphInput.userName, graphInput.lang);

  const history: BaseMessage[] = recentHistory.reverse().map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.text);
    }
    return new AIMessage(msg.text);
  });

  const messages: BaseMessage[] = [
    new SystemMessage(sys),
    ...history,
    new HumanMessage(graphInput.input),
  ];
  return messages;
}
