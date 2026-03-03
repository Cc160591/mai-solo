import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

export const database = drizzle(pool);

console.log('PostgreSQL database connected successfully');
