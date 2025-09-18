import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { GraphState } from '../state.js';
import { Command } from '@langchain/langgraph';
import { NODE_MODEL } from '../../../utils/constants.js';
import { formatSseEvent } from '../../../utils/event.js';

const sendEvent = (responseStream: NodeJS.WritableStream, toolName: string) => {
  if (toolName === 'list_transaction_types') {
    responseStream.write(formatSseEvent({ text: 'Estoy verificando el tipo de transaccion' }, 'callTool'));
    return;
  }

  if (toolName === 'list_transaction_categories') {
    responseStream.write(formatSseEvent({ text: 'Estoy verificando la categoria de la transaccion' }, 'callTool'));
    return;
  }

  if (toolName === 'chart_generator') {
    responseStream.write(formatSseEvent({ text: 'Estoy generando el grafico' }, 'callTool'));
    return;
  }

  responseStream.write(formatSseEvent({ text: 'Estoy buscando en la base de datos' }, 'callTool'));  
}

export async function callTools(
  state: GraphState,
  tools: Runnable<any, any>[],
): Promise<Command> {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls;
  if (!toolCalls) {
    throw new Error('No tool calls found');
  }

  const toolOutputs = await Promise.all(
    toolCalls.map(async (call) => {
      if (!call.id) {
        throw new Error('Tool call must have an id');
      }
      const tool = tools.find((t: any) => t.name === call.name);
      if (!tool) {
        throw new Error(`Tool ${call.name} not found`);
      }

      if (state.responseStream) {
        sendEvent(state.responseStream, call.name);
      }

      const output = await tool.invoke(call.args);
      return new ToolMessage({
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }),
  );

  return new Command({
    goto: NODE_MODEL,
    update: {
      ...state,
      messages: toolOutputs 
    },
  });
}
