import { Command } from '@langchain/langgraph';
import {
  NODE_CHITCHAT,
  NODE_GUARDRAILS,
} from '../../../../utils/constants';
import { generatePreFlowChecks } from './prompt';
import { GraphState } from '../../state';
import { invoke } from '../../../../utils/graph';
import { NODE_LOAD_CONTEXT } from '../../../../utils/constants';
import { formatSseEvent } from '../../../../utils/event';

export const preFlowClassifier = async (
  state: GraphState,
): Promise<Command> => {
  const prompt = generatePreFlowChecks(state);

  const result = await invoke(prompt);
  const nextNode = result.content.toString().trim();

  const DEFAULT_NEXT_NODE = NODE_LOAD_CONTEXT;

  if (nextNode === NODE_CHITCHAT) {
    return new Command({
      goto: NODE_CHITCHAT,
      update: { ...state },
    });
  }

  if (nextNode === NODE_GUARDRAILS) {
    return new Command({
      goto: NODE_GUARDRAILS,
      update: { ...state },
    });
  }

  if (state.responseStream) {
    state.responseStream.write(formatSseEvent( { text: '...', status: 'pending' }, 'preFlowClassifier'));
  }

  return new Command({
    goto: DEFAULT_NEXT_NODE,
    update: { ...state },
  });
};
