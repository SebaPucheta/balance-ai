import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || process.env.REGION || 'us-east-1' })
);

export type MemoryRole = 'user' | 'assistant';
export interface MemoryItem {
  userId: string;
  sk: string;
  role: MemoryRole;
  text: string;
  createdAt: number;
  ttl: number;
}

function isValidationException(e: any) {
  return e?.name === 'ValidationException' || /ValidationException/i.test(String(e?.message));
}

export class MemoryRepository {
  async store(userId: string, role: MemoryRole, text: string, ttlSeconds = 36000): Promise<void> {
    const now = Date.now();
    const sk = `ix#${now}`;
    const ttl = Math.floor(now / 1000) + ttlSeconds;
    const item: MemoryItem = { userId, sk, role, text, createdAt: now, ttl };
    await ddb.send(new PutCommand({ TableName: process.env.USER_MEMORY_TABLE, Item: item }));
  }

  async recent(userId: string, limit = 6): Promise<MemoryItem[]> {
    // Intento 1: asume sort key 'sk'
    try {
      const out = await ddb.send(new QueryCommand({
        TableName: process.env.USER_MEMORY_TABLE,
        KeyConditionExpression: 'userId = :u AND begins_with(#sk, :p)',
        ExpressionAttributeNames: { '#sk': 'sk' },
        ExpressionAttributeValues: { ':u': userId, ':p': 'ix#' },
        ScanIndexForward: false,
        Limit: limit
      }));
      return (out.Items as MemoryItem[]) || [];
    } catch (e) {
      if (!isValidationException(e)) throw e;
      // Intento 2: tabla sin sort key. Usar FilterExpression y ordenar en memoria
      const out = await ddb.send(new QueryCommand({
        TableName: process.env.USER_MEMORY_TABLE,
        KeyConditionExpression: 'userId = :u',
        ExpressionAttributeNames: { '#sk': 'sk' },
        ExpressionAttributeValues: { ':u': userId, ':p': 'ix#' },
        FilterExpression: 'begins_with(#sk, :p)',
        ScanIndexForward: false
      }));
      const items = ((out.Items as MemoryItem[]) || [])
        .filter(it => typeof it.sk === 'string' && it.sk.startsWith('ix#'))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, limit);
      return items;
    }
  }
}
