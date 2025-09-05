import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { END, StateGraph } from '@langchain/langgraph';
import { Firestore } from '@google-cloud/firestore';
import { buildModel, buildTools, GraphInput, prepareMessages } from './common.js';
import { graphState, GraphState } from './state.js';
import { callModel } from './nodes/callModel.js';
import { callTools } from './nodes/callTools.js';

function shouldContinue(state: GraphState): 'playground' | 'end' {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.additional_kwargs.tool_calls;
  return toolCalls?.length ? 'playground' : 'end';
}

export function buildGraph(firestore: Firestore) {
  const model = buildModel();
  const tools = buildTools(firestore);
  const tooled = model.bindTools(tools);

  const graph = new StateGraph({ channels: graphState })
    .addNode('model', (state) => callModel(state, tooled))
    .addNode('playground', (state) => callTools(state, tools));

  graph.setEntryPoint('model');
  graph.addConditionalEdges('model', shouldContinue, {
    playground: 'playground',
    end: END,
  });
  graph.addEdge('playground', 'model');

  const compiled = graph.compile();

  const run = async (graphInput: GraphInput) => {
    const messages = await prepareMessages(graphInput);
    const result = await compiled.invoke({
      messages,
      userId: graphInput.userId,
    });
    const lastMessage = result.messages[result.messages.length - 1] as AIMessage;
    return lastMessage.content.toString();
  }

  return { run };
}
