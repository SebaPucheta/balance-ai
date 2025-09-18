import { AIMessage } from '@langchain/core/messages';
import { END, START, StateGraph } from '@langchain/langgraph';
import { Firestore } from '@google-cloud/firestore';
import { buildModel, buildTools } from './common.js';
import { GraphState, graphState } from './state.js';
import { callModel } from './nodes/callModel.js';
import { callTools } from './nodes/callTools.js';
import { loadContext } from './nodes/loadContext.js';
import { NODE_CHITCHAT, NODE_GUARDRAILS, NODE_LOAD_CONTEXT, NODE_MODEL, NODE_PLAYGROUND, NODE_PRE_FLOW_CLASSIFIER, NODE_SAVE_CONTEXT } from '../../utils/constants.js';
import { preFlowClassifier } from './nodes/preFlowClassifier/preFlowClassifier.js';
import { chitchat } from './nodes/chitchat/chitchat.js';
import { guardrails } from './nodes/guardrails/guardrails.js';
import { saveContext } from './nodes/saveContext.js';

export function buildGraph(firestore: Firestore) {
  const model = buildModel();
  const tools = buildTools(firestore);
  const tooled = model.bindTools(tools);

  const graph = new StateGraph({ channels: graphState })
    .addNode(
      NODE_PRE_FLOW_CLASSIFIER,
      (state) => preFlowClassifier(state),
      {
        ends: [
          NODE_CHITCHAT,
          NODE_GUARDRAILS,
          NODE_LOAD_CONTEXT,
        ],
      }
    )
    .addNode(
      NODE_CHITCHAT,
      (state) => chitchat(state),
      { ends: [END] }
    )
    .addNode(
      NODE_GUARDRAILS,
      (state) => guardrails(state),
      { ends: [END] }
    )
    .addNode(
      NODE_LOAD_CONTEXT,
      (state) => loadContext(state),
      { ends: [NODE_MODEL] },
    )
    .addNode(
      NODE_MODEL,
      (state) => callModel(state, tooled),
      { ends: [NODE_PLAYGROUND, NODE_SAVE_CONTEXT]}
    )
    .addNode(
      NODE_PLAYGROUND,
      (state) => callTools(state, tools),
      { ends: [NODE_MODEL]},
    )
    .addNode(
      NODE_SAVE_CONTEXT,
      (state) => saveContext(state),
      { ends: [END]},
    );

  graph.addEdge(START, NODE_PRE_FLOW_CLASSIFIER);

  const compiled = graph.compile();

  const run = async (graphInput: GraphState) => {
    const result = await compiled.invoke({
      messages: [],
      userId: graphInput.userId,
      input: graphInput.input,
      userName: graphInput.userName,
      lang: graphInput.lang,
      responseStream: graphInput.responseStream,
    });
    const lastMessage = result.messages[result.messages.length - 1] as AIMessage;

    return lastMessage.content.toString();
  }

  return { run };
}
