import { GraphState } from "../../state";

/**
 * Generates a short chitchat prompt using Rioplatense voseo,
 * adapting to the user's tone.
 * @param {typeof StateAnnotation.State} state - The current state containing messages and context
 * @returns {string} Complete formatted prompt for chitchat generation
 */
export function guardrailsGeneratePrompt(
  state: GraphState
): string {

  return `
Your task:
- Reply using Rioplatense Spanish (voseo).
- Keep it short and direct.
- Use creative insult.
- It depends on the name, whether it is a user name or an insult for women or men. .
- Do not invent or assume any information.
- Do not use markdown, emojis, or special formatting.
- Use the short version of the name

User name:
"${state.userName}"

Output:
One line of plain text in Rioplatense voseo. Nothing else.
`.trim();
}
