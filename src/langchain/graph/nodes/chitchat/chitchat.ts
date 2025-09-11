import { SystemMessage } from '@langchain/core/messages';
import { Command, END } from '@langchain/langgraph';
import { invoke } from '../../../../utils/graph';
import { chitchatGeneratePrompt } from './prompt';
import { GraphState } from '../../state';

export const chitchat = async (
  state: GraphState,
): Promise<Command> => {
  const prompt = chitchatGeneratePrompt(state);
  const response = await invoke(prompt);

  return new Command({
    goto: END,
    update: {
      ...state,
      messages: [...state.messages, new SystemMessage(response!)],
    },
  });
};
