// @layer Infrastructure — CLI/脚本专用 Prisma 工厂

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

/**
 * 独立进程（CLI/脚本）使用的 Prisma 客户端工厂。
 *
 * 为什么不用 `src/lib/prisma.ts` 的单例：那是 Next 服务端的 Neon serverless 客户端，
 * 会在模块加载时建立连接并做 warmup。CLI 需要的是**与迁移前完全一致**的连接方式
 * （node-postgres Pool + PrismaPg，DATABASE_URL 去掉首尾引号），并且要能显式断开。
 * 该单例的搬迁属于后续 Phase，本阶段保持 CLI 行为不变。
 */
export interface StandalonePrismaHandle {
  client: PrismaClient
  disconnect: () => Promise<void>
}

export function createStandalonePrismaClient(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): StandalonePrismaHandle {
  // Strip quotes from DATABASE_URL (GitHub secrets may include them from .env)
  const url = (databaseUrl || '').replace(/^"(.*)"$/, '$1')
  const pool = new Pool({ connectionString: url })
  const adapter = new PrismaPg(pool)
  const client = new PrismaClient({ adapter })

  return {
    client,
    disconnect: () => client.$disconnect(),
  }
}
