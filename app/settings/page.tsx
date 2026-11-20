'use client'

import { useRouter } from 'next/navigation'
import { SKIN_LIST, getSkinTokens } from '@/lib/skins/tokens'
import { useSkin } from '@/components/SkinProvider'

export default function SettingsPage() {
  const router = useRouter()
  const { skin, mode, setSkin, setMode } = useSkin()

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--pg-bg)', color: 'var(--pg-text)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">外观设置</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
              皮肤只改变表面与配色，不改变任何电气含义
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--pg-accent)', color: '#fff' }}
          >
            返回
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">明暗</h2>
          <div className="flex gap-3">
            {(['light', 'dark'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className="px-4 py-2 rounded-lg text-sm border"
                style={{
                  borderColor: mode === item ? 'var(--pg-accent)' : 'var(--pg-border)',
                  background: mode === item ? 'var(--pg-accent-soft)' : 'var(--pg-surface)',
                  color: 'var(--pg-text)',
                }}
              >
                {item === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">皮肤</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SKIN_LIST.map((item) => {
              const tokens = getSkinTokens(item.id, mode)
              const active = skin === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setSkin(item.id)}
                  className="text-left rounded-xl border p-4 transition"
                  style={{
                    borderColor: active ? tokens.accent : 'var(--pg-border)',
                    background: 'var(--pg-surface)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-sm">{item.name}</span>
                    {active && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: tokens.accentSoft, color: tokens.accent }}
                      >
                        使用中
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 mb-3">
                    {[tokens.bg, tokens.surface, tokens.accent, tokens.edgeActive, tokens.edgeConflict].map((color) => (
                      <span key={color} className="w-6 h-6 rounded" style={{ background: color }} />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                    {item.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-10 text-xs leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
          皮肤覆盖画布、网格、连线与界面底色；元件本体的语义色（带电、失电、冲突）保持固定，避免不同皮肤下含义漂移。
          按元件类型切换符号样式（IEC / 国标 / 简化）属于下一阶段，会接在同一套 tokens 上。
        </div>
      </div>
    </div>
  )
}