import { SystemMessage } from '@langchain/core/messages';
import { Command, END } from '@langchain/langgraph';
import { GraphState } from '../../state';
import { guardrailsGeneratePrompt } from './prompt';
import { invoke } from '../../../../utils/graph';

export const guardrails = async (state: GraphState): Promise<Command> => {
  const prompt = guardrailsGeneratePrompt(state);
  const response = await invoke(prompt);
  return new Command({
    goto: END,
    update: {
      ...state,
      messages: [...state.messages, new SystemMessage(response!)],
    },
  });
};
