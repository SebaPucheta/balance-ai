import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { MemoryRepository } from '../memory/MemoryRepository.js';
import { Firestore } from '@google-cloud/firestore';
import { buildGraph } from '../langchain/graph/graph.js';
import { UserProfileRepository } from '../memory/UserProfileRepository.js';
import { GraphState } from '../langchain/graph/state.js';

const memory = new MemoryRepository();
const firestore = new Firestore();

let graphSingleton: Awaited<ReturnType<typeof buildGraph>> | null = null;

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = body.userId as string;
  const text = body.input as string;

  if (!userId || !text) return { statusCode: 400, body: JSON.stringify({ error: 'userId and input are required' }) };


  if (!graphSingleton) {
    graphSingleton = buildGraph(firestore);
  }

  const profiles = new UserProfileRepository();
  const profile = await profiles.get(userId);
  const lang = profile.language || 'es';
  const name = profile.name || 'Usuario';
  const reply = await graphSingleton.run({
    userId,
    input: text,
    userName: name,
    lang: lang,
  } as GraphState);

  await memory.store(userId, 'user', text);
  await memory.store(userId, 'assistant', reply);

  return {
    statusCode: 200,
    body: JSON.stringify({
      reply,
    })
  };
};