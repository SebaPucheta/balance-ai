import { GraphState } from '../state.js';
import { Runnable } from '@langchain/core/runnables';

export async function callModel(
  state: GraphState,
  model: Runnable,
): Promise<Partial<GraphState>> {
  const { messages } = state;
  const response = await model.invoke(messages);
  return {
    messages: [response],
  };
}
