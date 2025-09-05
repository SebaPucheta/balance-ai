import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { GraphState } from '../state.js';

export async function callTools(
  state: GraphState,
  tools: Runnable<any, any>[],
): Promise<Partial<GraphState>> {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.additional_kwargs.tool_calls;
  if (!toolCalls) {
    throw new Error('No tool calls found');
  }

  const toolOutputs = await Promise.all(
    toolCalls.map(async (call) => {
      const tool = tools.find((t: any) => t.name === call.function.name);
      if (!tool) {
        throw new Error(`Tool ${call.function.name} not found`);
      }
      const output = await tool.invoke(JSON.parse(call.function.arguments));
      return new ToolMessage({
        tool_call_id: call.id,
        content: JSON.stringify(output),
        name: call.function.name,
      });
    }),
  );

  return {
    messages: toolOutputs,
  };
}
