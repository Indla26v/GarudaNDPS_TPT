import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Warm up the Prisma/Neon DB connection with retry logic.
 * Neon suspends idle compute after ~5 minutes; the first connection
 * after sleep can take several seconds. This function retries up to
 * `maxRetries` times with exponential backoff so that serverless
 * cold-starts don't immediately fail.
 */
export async function warmUpConnection(maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      console.warn(
        `[Prisma] Connection warm-up attempt ${attempt}/${maxRetries} failed:`,
        (err as Error).message
      );
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }
  return false;
}

export default prisma;
