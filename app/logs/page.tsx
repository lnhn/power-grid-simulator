'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PowerGrid {
  id: string
  name: string
  description: string | null
  updatedAt: string
}

interface OperationLog {
  id: string
  gridId: string
  action: string
  targetId: string
  details: string | null
  timestamp: string
  user: {
    username: string
    role: string
  }
}

export default function LogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [grids, setGrids] = useState<PowerGrid[]>([])
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchGrids()
    fetchLogs()
  }, [])

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/grids')
      const data = await res.json()
      setGrids(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch grids:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs')
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    router.push('/api/auth/signout')
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  const isEngineer = session?.user?.role === 'ENGINEER'

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 左侧导航栏 */}
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
          <Link
            href="/equipment"
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>设备清单</span>
          </Link>
          <span className="flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 font-medium">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>操作记录</span>
          </span>
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

      {/* 主内容区 */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* 页面标题 */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">操作记录</h2>
            <p className="text-gray-600 mt-1">查看所有电网的模拟操作历史记录</p>
          </div>

          {/* 操作记录表格 */}
          {logs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-lg">暂无操作记录</p>
              <p className="text-gray-400 mt-2">在模拟运行页面进行操作后会自动记录</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">时间</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">电网</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">操作</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">操作人</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => {
                      const grid = grids.find(g => g.id === log.gridId)
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-3 px-4">
                            <Link 
                              href={`/grid/${log.gridId}/simulate`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {grid?.name || '未知电网'}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {log.details || log.action}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {log.user.username}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}