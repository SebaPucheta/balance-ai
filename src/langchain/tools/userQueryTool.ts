import { Firestore } from '@google-cloud/firestore';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

// ---- Main tool ----
export function makeUserQueryTool(firestore: Firestore) {
  return new DynamicStructuredTool({
    name: 'user_query',
    description:
      "Busca usuarios en la colección 'users' por una lista de posibles 'displayNames' o 'emails'. " +
      "Devuelve una lista de usuarios que coinciden con cualquiera de los criterios de búsqueda. " +
      "Cada usuario en la lista incluye 'userUid', 'displayName', y 'email'. " +
      "Usa este tool para obtener el 'userUid' de un usuario cuando necesites filtrar transacciones por un usuario específico.",
    schema: z.object({
      displayNames: z.array(z.string()).optional().describe("Una lista de posibles nombres (display_name) a buscar."),
      emails: z.array(z.string()).optional().describe("Una lista de posibles correos electrónicos (email) a buscar."),
    }),
    async func({ displayNames, emails }) {
      console.log('makeUserQueryTool', { displayNames, emails });

      if (!displayNames?.length && !emails?.length) {
        return JSON.stringify({ error: "Se debe proporcionar al menos una lista de 'displayNames' o 'emails'." });
      }

      const usersRef = firestore.collection('users');
      const queries = [];

      // Firestore 'in' query has a limit of 30 elements.
      if (displayNames?.length) {
        queries.push(usersRef.where('display_name', 'in', displayNames.slice(0, 30)).get());
      }
      if (emails?.length) {
        queries.push(usersRef.where('email', 'in', emails.slice(0, 30)).get());
      }

      try {
        const querySnapshots = await Promise.all(queries);

        const results = new Map<string, { userUid: string; displayName: string; email: string; }>();

        querySnapshots.forEach(snap => {
          snap.forEach(doc => {
            if (!results.has(doc.id)) {
              const data = doc.data();
              results.set(doc.id, {
                userUid: doc.id,
                displayName: data.display_name || '',
                email: data.email || '',
              });
            }
          });
        });
        
        const users = Array.from(results.values());

        return JSON.stringify({ users, count: users.length });

      } catch (error) {
        console.error("Error querying users:", error);
        return JSON.stringify({ error: "Failed to query users.", details: error.message });
      }
    }
  });
}
