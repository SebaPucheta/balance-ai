import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { MemoryRepository } from '../memory/MemoryRepository.js';
import { Firestore } from '@google-cloud/firestore';
import { buildChain, ChainInput } from '../langchain/chain.js';

const memory = new MemoryRepository();
const firestore = new Firestore();

let chainSingleton: Awaited<ReturnType<typeof buildChain>> | null = null;

export const handler: APIGatewayProxyHandlerV2 = async (event: any) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = body.userId as string;
  const text = body.input as string;
  console.log(body)
  if (!userId || !text) return { statusCode: 400, body: JSON.stringify({ error: 'userId and input are required' }) };


  if (!chainSingleton) {
    chainSingleton = await buildChain(firestore);
  }

  const reply = await chainSingleton.run({ userId, input: text } as ChainInput);

  await memory.store(userId, 'user', text);
  await memory.store(userId, 'assistant', reply);

  return {
    statusCode: 200,
    body: JSON.stringify({
      reply,
    })
  };
};