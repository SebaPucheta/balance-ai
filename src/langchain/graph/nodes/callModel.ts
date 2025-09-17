import { Command } from '@langchain/langgraph';
import { GraphState } from '../state.js';
import { Runnable } from '@langchain/core/runnables';
import { AIMessage } from '@langchain/core/messages';
import { NODE_PLAYGROUND, NODE_SAVE_CONTEXT } from '../../../utils/constants.js';

export async function callModel(
  state: GraphState,
  model: Runnable,
): Promise<Command> {
  const { messages } = state;

  const response = await model.invoke(messages);

  return new Command({
    goto: decideNextStep([response]),
    update: {
      ...state,
      messages: [response],
    }
  });
}

function decideNextStep(messages: AIMessage[]): typeof NODE_PLAYGROUND | typeof NODE_SAVE_CONTEXT {
  const lastMessage = messages[messages.length - 1];
  return lastMessage.tool_calls?.length ? NODE_PLAYGROUND : NODE_SAVE_CONTEXT;
}
