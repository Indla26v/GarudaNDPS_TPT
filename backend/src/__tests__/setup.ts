import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

// Increase timeout for DB-connected tests
jest.setTimeout(15000);
