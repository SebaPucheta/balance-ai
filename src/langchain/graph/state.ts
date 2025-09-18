import { BaseMessage } from '@langchain/core/messages';
import { StateGraphArgs } from '@langchain/langgraph';

export interface GraphState {
  messages: BaseMessage[];
  userId: string;
  input: string;
  userName: string;
  lang: string;
  responseStream?: NodeJS.WritableStream; 
}

export const graphState: StateGraphArgs<GraphState>['channels'] = {
  messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
  userId: {
    value: (x: string, y: string) => y ?? x,
    default: () => '',
  },
  input: {
    value: (x: string, y: string) => y ?? x,
    default: () => '',
  },
  userName:{
    value: (x: string, y: string) => y ?? x,
    default: () => '',
  },
  lang:{
    value: (x: string, y: string) => y ?? x,
    default: () => '',
  },
  responseStream: {
    value: (x?: NodeJS.WritableStream, y?: NodeJS.WritableStream) => y ?? x,
    default: () => undefined,
  },
};
