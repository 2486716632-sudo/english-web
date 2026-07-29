import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  warmedUp: boolean | undefined
}

function createPrismaClient() {
  // Use direct Neon endpoint (not PgBouncer pooler) so startup params like
  // statement_timeout are accepted. The Neon serverless driver handles its own
  // connection pooling via WebSocket, so PgBouncer is redundant here.
  const baseUrl = process.env.DATABASE_URL!
  const directUrl = baseUrl.replace('-pooler', '')
  const url = directUrl.includes('statement_timeout')
    ? directUrl
    : directUrl + (directUrl.includes('?') ? '&' : '?') + 'options=--statement_timeout%3D15000'
  const adapter = new PrismaNeon({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  })
  const client = new PrismaClient({ adapter })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Warm up Neon connection pool on first load (cold start ~8s)
if (!globalForPrisma.warmedUp) {
  globalForPrisma.warmedUp = true
  prisma.$queryRaw`SELECT 1 AS warmed_up`.catch(() => {
    // Non-fatal — queries will retry on the warmed connection on first request
    globalForPrisma.warmedUp = false
  })
}
