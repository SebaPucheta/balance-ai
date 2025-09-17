import { Command, END } from '@langchain/langgraph';
import { GraphState } from '../state.js';
import { MemoryRepository } from '../../../memory/MemoryRepository.js';

const memory = new MemoryRepository();
export async function saveContext(state: GraphState): Promise<Command> {
  await memory.store(state.userId, 'user', state.input);
  await memory.store(state.userId, 'assistant', state.messages[state.messages.length - 1].content.toString());
  return new Command({
    goto: END,
  })
}
