import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'

/** 兼容存量数据的默认租户 */
export const DEFAULT_TENANT_ID = 'default'

/** 从会话读取租户；旧会话没有 tenantId 时回退到默认租户 */
export function tenantIdOf(session: Session | null): string {
  const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId
  return typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : DEFAULT_TENANT_ID
}

/**
 * 所有按 id 访问电网的接口都必须经过这里，避免跨租户 IDOR。
 * 找不到或不属于当前租户时统一返回 null，由调用方转成 404。
 */
export function getScopedGrid(session: Session | null, id: string) {
  return prisma.powerGrid.findFirst({
    where: { id, tenantId: tenantIdOf(session) },
  })
}

/** 校验某个电网是否属于当前租户（日志写入前使用） */
export async function gridBelongsToTenant(session: Session | null, id: string): Promise<boolean> {
  const grid = await prisma.powerGrid.findFirst({
    where: { id, tenantId: tenantIdOf(session) },
    select: { id: true },
  })
  return Boolean(grid)
}
