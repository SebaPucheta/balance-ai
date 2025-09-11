import { BaseMessage, isHumanMessage } from "@langchain/core/messages";
import { buildModel } from "../langchain/graph/common";
import { GraphState } from "../langchain/graph/state";

export function invoke (prompt: string) {
  const model = buildModel();
  return model.invoke(prompt);
}

export function extractLastHumanMessages(
  state: GraphState,
): string {
  const messages = (state.messages as BaseMessage[]) || [];

  const filtered = messages.filter((msg) => isHumanMessage(msg));

  const lastMessages = filtered.slice(-1).map((msg) => msg.content);

  return JSON.stringify(lastMessages);
}