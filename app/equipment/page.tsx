'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface GridItem {
  id: string
  name: string
  description: string | null
  updatedAt: string
}

interface EquipmentItem {
  id: string
  nodeId: string
  name: string
  type: string
  subType: string | null
  power: number | null
  voltage: number | null
  current: number | null
  description: string | null
  specs: string | null
}

interface GridWithEquipment extends GridItem {
  equipment: EquipmentItem[]
}

const typeLabels: Record<string, string> = {
  powerSource: '电源',
  switch: '断路器',
  load: '负载',
  bus: '母线',
}

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [grids, setGrids] = useState<GridItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GridWithEquipment | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    fetchGrids()
  }, [])

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/grids')
      const data = await res.json()
      setGrids(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const openGrid = async (id: string) => {
    try {
      const res = await fetch(`/api/grids/${id}/equipment`)
      const data = await res.json()
      if (data.id) setSelected(data)
    } catch (e) {
      console.error(e)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => router.push('/api/auth/signout')
  const isEngineer = session?.user?.role === 'ENGINEER'

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">电网模拟系统</h1>
              <p className="text-xs text-gray-500">化工厂电网管理</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h2a2 2 0 012 2z" />
            </svg>
            <span>电网列表</span>
          </Link>
          <span className="flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 font-medium">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>设备清单</span>
          </span>
          <Link
            href="/logs"
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>操作记录</span>
          </Link>
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-2">
          <div className="px-3 py-2 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{session?.user?.name}</p>
            <p className="text-xs text-gray-500">{isEngineer ? '工程师' : '操作员'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {!selected ? (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">设备清单</h2>
                <p className="text-gray-600 mt-1">
                  设备清单在编辑电网并保存后自动同步，与电网一致。选择电网可查看与导出。
                </p>
              </div>

              {grids.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-500">暂无电网。请先在电网列表中创建电网，编辑并保存后，设备清单将自动生成。</p>
                  <Link href="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">前往电网列表</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grids.map((g) => (
                    <div
                      key={g.id}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition overflow-hidden flex flex-col h-full"
                    >
                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{g.name}</h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1 min-h-[40px]">
                          {g.description || '暂无描述'}
                        </p>
                        <p className="text-xs text-gray-400 mb-4">
                          更新于 {new Date(g.updatedAt).toLocaleString('zh-CN')}
                        </p>
                        <button
                          onClick={() => openGrid(g.id)}
                          className="w-full px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition mt-auto"
                        >
                          查看设备清单 / 导出
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelected(null)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">{selected.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/grids/${selected.id}/equipment/export?format=csv`}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    导出 CSV
                  </a>
                  <a
                    href={`/api/grids/${selected.id}/equipment/export?format=json`}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    导出 JSON
                  </a>
                  {isEngineer && (
                    <Link
                      href={`/grid/${selected.id}/edit`}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
                    >
                      编辑电网
                    </Link>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                以下设备由该电网画布保存时自动同步。修改设备请到「编辑电网」中调整节点后保存。
              </p>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">序号</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">节点ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">设备名称</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">类型</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">子类型</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">功率(kW)</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">电压(V)</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">电流(A)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.equipment.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-gray-500">
                            暂无设备。请在「编辑电网」中添加节点并保存，设备清单将自动更新。
                          </td>
                        </tr>
                      ) : (
                        selected.equipment.map((e, i) => (
                          <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-600">{i + 1}</td>
                            <td className="py-3 px-4 text-gray-600 font-mono text-xs">{e.nodeId}</td>
                            <td className="py-3 px-4 font-medium text-gray-900">{e.name}</td>
                            <td className="py-3 px-4 text-gray-600">{typeLabels[e.type] || e.type}</td>
                            <td className="py-3 px-4 text-gray-600">{e.subType || '-'}</td>
                            <td className="py-3 px-4 text-gray-600">{e.power ?? '-'}</td>
                            <td className="py-3 px-4 text-gray-600">{e.voltage ?? '-'}</td>
                            <td className="py-3 px-4 text-gray-600">{e.current ?? '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
