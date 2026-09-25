import { Pool, QueryResult, QueryResultRow } from 'pg';

const globalForPool = globalThis as unknown as { __civresPool?: Pool };

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Postgres store requires it.');
  }
  if (!globalForPool.__civresPool) {
    globalForPool.__civresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    globalForPool.__civresPool.on('error', (err) => {
      console.error('Unexpected error on idle Postgres client', err);
    });
  }
  return globalForPool.__civresPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}