import { Firestore, Timestamp } from '@google-cloud/firestore';
import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

type TxUserRef = string | FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
interface TransactionDoc {
  id?: string;
  user?: TxUserRef;
  amount?: number;
  date?: FirebaseFirestore.Timestamp | string;
  category?: string;
  tenant?: string;
  type?: string;
  description?: string;
  // free fields
  [k: string]: any;
}

const OrderSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc')
});

const GroupSchema = z.object({
  by: z.array(z.string()).min(1),
  sum: z.array(z.string()).default([]),
  includeDocs: z.boolean().default(false)
});

const FilterSchema = z.object({
  field: z.string(),
  op: z.enum(['==','>','>=','<','<=','in','array-contains','array-contains-any','not-in']),
  value: z.union([
    z.string(), z.number(), z.boolean(),
    z.array(z.string()), z.array(z.number())
  ])
});

type Catalog = { byId: Map<string,string>; byName: Map<string,string> };

// in-memory caches (live in the Lambda runtime)
let _typesCache: Catalog | null = null;
let _catsCache: Catalog | null = null;

async function loadTypes(db: Firestore): Promise<Catalog> {
  if (_typesCache) return _typesCache;
  const snap = await db.collection('transactionTypes').get();
  const byId = new Map<string,string>();
  const byName = new Map<string,string>();
  snap.forEach(d => {
    const id = d.get('id') ?? d.id;
    const name = String(d.get('name') ?? '').trim();
    if (id && name) {
      byId.set(String(id), name);
      byName.set(name.toLowerCase(), name);
    }
  });
  _typesCache = { byId, byName };
  return _typesCache;
}

async function loadCategories(db: Firestore): Promise<Catalog> {
  if (_catsCache) return _catsCache;
  const snap = await db.collection('transactionCategories').get();
  const byId = new Map<string,string>();
  const byName = new Map<string,string>();
  snap.forEach(d => {
    const id = d.get('id') ?? d.id;
    const name = String(d.get('name') ?? '').trim();
    if (id && name) {
      byId.set(String(id), name);
      byName.set(name.toLowerCase(), name);
    }
  });
  _catsCache = { byId, byName };
  return _catsCache;
}

// ---- Main tool ----
export function makeFirestoreQueryTool(firestore: Firestore) {
  return new DynamicStructuredTool({
    name: 'firestore_query_advanced',
    description:
      "Consulta 'transactions' con filtros por user, type, category, tenant, amount, rango de fechas; " +
      "permite ordenar (por defecto 'date' desc), paginar (startAfter) y agrupar (group by / sum). " +
      "El campo 'date' es un Timestamp. El campo 'user' es un string path '/users/<uid>'. " +
      "Además permite filtrar por substring en 'description' mediante 'descriptionContains'. " + 
      "Para agrupar, puedes usar 'categoryName' (para agrupar por 'category'), 'typeName' (para agrupar por 'type'), o 'yearMonth' (para agrupar por mes en formato YYYY-MM).",
    schema: z.object({
      // User (one or the other)
      userUid: z.string().nullable().default(null),          // "kY2F..."
      userPath: z.string().nullable().default(null),         // "users/kY2..." or "/users/kY2..."

      // Type (by id or name; resolved against 'transactionTypes')
      typeId: z.string().nullable().default(null),
      typeName: z.string().nullable().default(null),

      // Category (by id or name; resolved against 'transactionCategories')
      categoryId: z.string().nullable().default(null),
      categoryName: z.string().nullable().default(null),
      categories: z.array(z.string()).default([]),           // multiple categories by name

      tenant: z.string().nullable().default(null),           // "home", etc.

      amount: z.object({
        gte: z.number().nullable().default(null),
        lte: z.number().nullable().default(null)
      }).default({ gte: null, lte: null }),

      date: z.object({
        fromMs: z.number().nullable().default(null),
        toMs: z.number().nullable().default(null)
      }).default({ fromMs: null, toMs: null }),

      // Free filters (in case something extra is needed)
      filters: z.array(FilterSchema).default([]),

      descriptionContains: z.string().nullable().default(null),

      orderBy: z.array(OrderSchema).default([{ field: 'date', direction: 'desc' }]),
      limit: z.number().int().positive().max(2000).default(100),

      startAfter: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),

      project: z.array(z.string()).default([]),
      group: GroupSchema.nullable().default(null)
    }),
    async func(args) {
      console.log('makeFirestoreQueryTool', args)
      const col = firestore.collection('transactions');
      // User
      let userPath: string | null = null;
      if (args.userUid) {
        userPath = `/users/${String(args.userUid).trim().replace(/^\/+/, '')}`;
      } else if (args.userPath) {
        const p = String(args.userPath).trim().replace(/^\/+/, '');
        userPath = p.startsWith('users/') ? `/${p}` : `/${p}`;
      }

      // Load catalogs and resolve type/category
      let typeNameCanon: string | null = null;
      if (args.typeName || args.typeId) {
        const types = await loadTypes(firestore);
        if (args.typeName) {
          const k = String(args.typeName).toLowerCase();
          typeNameCanon = types.byName.get(k) ?? args.typeName;
        } else if (args.typeId) {
          typeNameCanon = types.byId.get(String(args.typeId)) ?? null;
        }
      }

      let categoryNameCanon: string | null = null;
      if (args.categoryName || args.categoryId) {
        const cats = await loadCategories(firestore);
        if (args.categoryName) {
          const k = String(args.categoryName).toLowerCase();
          categoryNameCanon = cats.byName.get(k) ?? args.categoryName;
        } else if (args.categoryId) {
          categoryNameCanon = cats.byId.get(String(args.categoryId)) ?? null;
        }
      }

      const orderByList = Array.isArray(args.orderBy) && args.orderBy.length
        ? args.orderBy
        : [{ field: 'date', direction: 'desc' as const }];

      const limitNum = Number.isFinite(args.limit) ? Number(args.limit) : 100;
      const startAfterVals = Array.isArray(args.startAfter) ? args.startAfter.slice() : [];

      let q: FirebaseFirestore.Query = col;

      if (userPath) q = q.where('user', '==', userPath);
      if (typeNameCanon) q = q.where('type', '==', typeNameCanon);

      if (categoryNameCanon) {
        q = q.where('category', '==', categoryNameCanon);
      } else if (Array.isArray(args.categories) && args.categories.length === 1) {
        q = q.where('category', '==', args.categories[0]);
      } else if (Array.isArray(args.categories) && args.categories.length > 1) {
        q = q.where('category', 'in', args.categories.slice(0, 10));
      }

      if (args.tenant) q = q.where('tenant', '==', args.tenant);

      if (args.amount && args.amount.gte != null) q = q.where('amount', '>=', args.amount.gte as number);
      if (args.amount && args.amount.lte != null) q = q.where('amount', '<=', args.amount.lte as number);

      // Range by 'date' (Timestamp)
      let fromTs = (args.date && typeof args.date.fromMs === 'number')
        ? Timestamp.fromMillis(args.date.fromMs)
        : undefined;
      let toTs = (args.date && typeof args.date.toMs === 'number')
        ? Timestamp.fromMillis(args.date.toMs)
        : undefined;

      // Si no se especifica un rango de fechas, por defecto se busca el mes actual.
      if (!fromTs && !toTs) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        fromTs = Timestamp.fromDate(startOfMonth);
        toTs = Timestamp.fromDate(endOfMonth);
      }

      if (fromTs) q = q.where('date', '>=', fromTs);
      if (toTs)   q = q.where('date', '<=', toTs);

      // Additional filters
      if (Array.isArray(args.filters)) {
        for (const f of args.filters) {
          q = q.where(f.field, f.op as any, f.value as any);
        }
      }

      // Order
      const isGroupingByYearMonth = args.group && args.group.by.includes('yearMonth');
      for (const o of orderByList) {
        // Si se agrupa por 'yearMonth', no podemos ordenar por él en la DB.
        // La herramienta lo ordenará en memoria después.
        if (isGroupingByYearMonth && o.field === 'yearMonth') {
          continue;
        }
        // Si se está agrupando y se pide ordenar por un campo que se va a sumar,
        // se omite el orderBy en la consulta a la DB. La herramienta lo ordenará en memoria después.
        if (args.group && args.group.sum.length > 0) {
          if (args.group.sum.includes(o.field) || o.field.startsWith('sum_')) {
            continue;
          }
        }
        q = q.orderBy(o.field, o.direction);
      }

      // Cursor
      if (startAfterVals.length && orderByList.length) {
        q = q.startAfter(...startAfterVals);
      }

      // Limit
      if (limitNum > 0) {
        q = q.limit(limitNum);
      }

      // 1) Execute the main query
      const snap = await q.get();
      let docs: TransactionDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      // 1.b) Filter by substring in description (case-insensitive, with normalization)
      if (args.descriptionContains && typeof args.descriptionContains === 'string') {
        const needle = args.descriptionContains
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        docs = docs.filter(d => {
          const hay = typeof d.description === 'string' ? d.description : '';
          const hayNorm = hay.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return needle.length > 0 && hayNorm.includes(needle);
        });
      }

      // 2) Resolve user names BEFORE projecting
      const userCache = new Map<string, string>();
      async function resolveUserName(pathOrRef: TxUserRef | undefined): Promise<string | null> {
        if (!pathOrRef) return null;
        let path: string | undefined;

        if (typeof pathOrRef === 'string') {
          path = pathOrRef.replace(/^\/+/, '');            // "/users/uid" → "users/uid"
        } else if ('path' in pathOrRef && pathOrRef.path) {
          path = pathOrRef.path;                           // DocumentReference.path
        } else if ('id' in pathOrRef && pathOrRef.id) {
          path = `users/${pathOrRef.id}`;
        }
        if (!path) return null;

        const uid = path.split('/').pop()!;
        if (userCache.has(uid)) return userCache.get(uid)!;

        try {
          const uSnap = await firestore.doc(`users/${uid}`).get();
          const display = (uSnap.data()?.display_name as string) ?? uid;
          userCache.set(uid, display);
          return display;
        } catch {
          return uid;
        }
      }

      // 3) Enrich each document with userDisplayName
      docs = await Promise.all(
        docs.map(async d => {
          const userDisplayName = await resolveUserName(d.user);
          const { date, ...rest } = d;
          let dateFormatted: string | undefined, yearMonth: string | undefined;

          if (date && typeof date !== 'string' && typeof date.toDate === 'function') {
            const dt = date.toDate() as Date;
            const day = String(dt.getDate()).padStart(2, '0');
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const year = dt.getFullYear();
            dateFormatted = `${day}/${month}/${year}`;
            yearMonth = `${year}-${month}`;
          }
          return { ...rest, date: dateFormatted || date, yearMonth, user: userDisplayName ?? d.user };
        })
      );

      // 4) Grouping (if applicable)
      if (args.group) {
        // Map aliases to actual field names for grouping
        const by = args.group.by.map(field => {
          if (field === 'categoryName') return 'category';
          if (field === 'typeName') return 'type';
          return field;
        });
        const sum = new Set(args.group.sum);
        const map = new Map<string, any>();
        for (const d of docs) {
          const key = JSON.stringify(by.map(k => (d as any)[k]));
          const cur = map.get(key) || {
            key: by.reduce((acc, k) => ({ ...acc, [k]: (d as any)[k] }), {}),
            count: 0
          };
          cur.count += 1;
          for (const s of sum) cur[s] = (cur[s] || 0) + (Number((d as any)[s]) || 0);
          if (args.group.includeDocs) { (cur as any).docs ??= []; (cur as any).docs.push(d); }
          map.set(key, cur);
        }

        let groups = Array.from(map.values());
        const orderField = orderByList.length > 0 ? orderByList[0] : null;

        // Si se pide ordenar por un campo que fue sumado, ordenamos los grupos por ese campo.
        if (orderField && sum.has(orderField.field)) {
          const dir = orderField.direction === 'desc' ? -1 : 1;
          groups.sort((a, b) => dir * ((a[orderField.field] || 0) - (b[orderField.field] || 0)));
        } else {
          // Si se agrupa por 'yearMonth', ordenamos los grupos resultantes en memoria.
          if (isGroupingByYearMonth) {
            const dir = orderByList.find(o => o.field === 'yearMonth')?.direction === 'desc' ? -1 : 1;
            groups.sort((a, b) => dir * a.key.yearMonth.localeCompare(b.key.yearMonth));
          } else {
            // Para otras agrupaciones, ordenamos por la clave para una salida consistente.
            groups.sort((a, b) => JSON.stringify(a.key).localeCompare(JSON.stringify(b.key)));
          }
        }
        return JSON.stringify({ groups, count: docs.length });
      }

      // 5) Projection (if applicable)
      if (args.project.length) {
        const haveDisplay = args.project.includes('userDisplayName');
        const proj = args.project.slice();
        if (!haveDisplay) proj.push('userDisplayName');

        const projected = docs.map(d => {
          const out: Record<string, any> = { id: d.id };
          for (const f of proj) out[f] = (d as any)[f];
          return out;
        });
        return JSON.stringify({ docs: projected, count: projected.length });
      }

      // 6) No projection
      return JSON.stringify({ docs, count: docs.length });
    }
  });
}
