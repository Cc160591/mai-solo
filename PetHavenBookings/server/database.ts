import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { bookings, closures } from '@shared/schema';

// Get the database URL from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Initialize Neon PostgreSQL client
const sql = neon(databaseUrl);

// Initialize Drizzle ORM with Neon
export const database = drizzle(sql);

console.log('PostgreSQL database connected successfully');
