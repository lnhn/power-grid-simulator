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



export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [grids, setGrids] = useState<PowerGrid[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    fetchGrids()
  }, [])

  const fetchGrids = async () => {
    try {
      const res = await fetch('/api/grids')
      const data = await res.json()
      setGrids(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch grids:', error)
    } finally {
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
      {/* 左侧导航栏 - 仅 Dashboard 使用 */}
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
            className="flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* 主内容区 */}
      <main className="flex-1 min-w-0">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 页面标题和操作按钮 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">电网列表</h2>
            <p className="text-gray-600 mt-1">选择一个电网进行{isEngineer ? '编辑或' : ''}模拟操作</p>
          </div>
          
          {isEngineer && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>创建电网</span>
            </button>
          )}
        </div>

        {/* 电网卡片网格 */}
        {grids.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 text-lg">暂无电网</p>
            {isEngineer && (
              <p className="text-gray-400 mt-2">点击上方按钮创建第一个电网</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grids.map((grid) => (
              <div
                key={grid.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition overflow-hidden flex flex-col h-full"
              >
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{grid.name}</h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1 min-h-[40px]">
                    {grid.description || '暂无描述'}
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    更新于 {new Date(grid.updatedAt).toLocaleString('zh-CN')}
                  </p>
                  
                  <div className="flex space-x-2 mt-auto">
                    <Link
                      href={`/grid/${grid.id}/simulate`}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition text-center"
                    >
                      模拟运行
                    </Link>
                    {isEngineer && (
                      <Link
                        href={`/grid/${grid.id}/edit`}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition text-center"
                      >
                        编辑
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建电网弹窗 */}
      {showCreateModal && (
        <CreateGridModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchGrids()
          }}
        />
      )}
      </main>
    </div>
  )
}

function CreateGridModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/grids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        onSuccess()
      } else {
        setError(data.error || '创建失败，请重试')
      }
    } catch (err) {
      console.error('Failed to create grid:', err)
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">创建新电网</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              电网名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="例如: 车间A电网"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述 (可选)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              rows={3}
              placeholder="简要描述这个电网的用途"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
