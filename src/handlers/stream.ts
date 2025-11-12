import { Firestore } from '@google-cloud/firestore';
import { buildGraph } from '../langchain/graph/graph.js';
import { UserProfileRepository } from '../memory/UserProfileRepository.js';
import { GraphState } from '../langchain/graph/state.js';
import type {
  APIGatewayProxyEvent,
  Context,
  Handler,
} from 'aws-lambda';
import { formatSseEvent } from '../utils/event.js';

declare const awslambda: {
  streamifyResponse: (
    handler: (
      event: APIGatewayProxyEvent,
      responseStream: awslambda.HttpResponseStream,
      context: Context,
    ) => Promise<void>,
  ) => Handler;

  HttpResponseStream: {
    from: (
      stream: NodeJS.WritableStream,
      init?: {
        statusCode?: number;
        headers?: Record<string, string>;
      }
    ) => NodeJS.WritableStream;
  };
};

const firestore = new Firestore();

let graphSingleton: Awaited<ReturnType<typeof buildGraph>> | null = null;


export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const userId = body.userId as string;
      const text = body.input as string;

      if (!userId || !text) {
        responseStream.write(formatSseEvent({ message: 'userId and input are required' }, 'error'));
        // Cerramos el stream aquí porque la solicitud no es válida.
        responseStream.end();
        return;
      }

      const sseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
      if (!graphSingleton) {
        graphSingleton = buildGraph(firestore);
      }

      const profiles = new UserProfileRepository();
      const profile = await profiles.get(userId);
      const lang = profile.language || 'es';
      const name = profile.name || 'Usuario';

      // El grafo ahora se ejecutará y enviará eventos intermedios a través del responseStream.
      const finalMessage = await graphSingleton.run({
        userId,
        input: text,
        userName: name,
        lang: lang,
        responseStream: sseStream,
      } as GraphState);

      // Enviamos la respuesta final del grafo.
      sseStream.write(formatSseEvent({...JSON.parse(finalMessage), status: 'done'}, 'finalResponse'));
    } catch (error: any) {
      console.error('Error en el handler de streaming:', error);
      responseStream.write(formatSseEvent({ message: 'Ocurrió un error en el servidor.', detail: error.message, status: 'done' }, 'error'));
    } finally {
      // 2. Asegurarnos de que el stream siempre se cierre.
      responseStream.end();
    }
  },
);