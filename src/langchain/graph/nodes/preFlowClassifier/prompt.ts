import { NODE_CHITCHAT, NODE_GUARDRAILS } from '../../../../utils/constants';
import { GraphState } from '../../state';

/**
 * Generates a pre-flow classification prompt to categorize user messages.
 * @param {typeof StateAnnotation.State} state - The current state containing messages and context
 * @returns {string} Complete formatted prompt for pre-flow classification
 */
export function generatePreFlowChecks(
  state: GraphState
): string {;
  const availableCategories = [NODE_CHITCHAT, NODE_GUARDRAILS];

  return `
###TASK:
You are a classification assistant for a chatbot from Balance App (Argentina).

Your job is to classify the user's message into one of the following categories:

- ${NODE_CHITCHAT}
- ${NODE_GUARDRAILS}
Or return null if there is no match.

---

###ACTION:
Follow these criteria strictly:

1. **${NODE_CHITCHAT}** → Use ONLY if the message is a greeting, thank you, joke, or off-topic comment.

2. **${NODE_GUARDRAILS}** → Use ONLY if the message contains insults, threats, or inappropriate content.

---

###GOAL:
Your response MUST be one of:

${availableCategories.join('\n')}

Or return:
null

Output must be plain text:
- No quotes
- No markdown
- No formatting
- No explanation

---

###EXAMPLES:

User message: hola  
Answer: ${NODE_CHITCHAT}

User message: me quiero matar  
Answer: ${NODE_GUARDRAILS}

User message: quiero saber sobre transacciones, categorias o tipo de transacciones, movimientos y similar
Answer: null

---

###INPUT

User message:
${state.input}

---

Output:
${availableCategories.join(' | ')} | null
(plain text only – no quotes)
`.trim();
}
