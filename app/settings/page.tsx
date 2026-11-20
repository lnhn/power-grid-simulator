'use client'

import { useRouter } from 'next/navigation'
import { SKIN_LIST, SYMBOL_LIST, getSkinTokens } from '@/lib/skins/tokens'
import { getSkinSpec } from '@/lib/skins/spec'
import { useSkin } from '@/components/SkinProvider'

export default function SettingsPage() {
  const router = useRouter()
  const { skin, mode, symbolSet, setSkin, setMode, setSymbolSet } = useSkin()

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--pg-bg)', color: 'var(--pg-text)', fontFamily: 'var(--pg-font)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">外观设置</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
              皮肤只改变表面与配色，符号集只改变画法，两者都不改变任何电气含义
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--pg-accent)', color: '#fff', borderRadius: 'var(--pg-radius)' }}
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
                className="px-4 py-2 text-sm border"
                style={{
                  borderRadius: 'var(--pg-radius)',
                  borderColor: mode === item ? 'var(--pg-accent)' : 'var(--pg-border)',
                  background: mode === item ? 'var(--pg-accent-soft)' : 'var(--pg-panel)',
                  color: 'var(--pg-text)',
                }}
              >
                {item === 'light' ? '浅色' : '深色'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-3">皮肤</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SKIN_LIST.map((item) => {
              const tokens = getSkinTokens(item.id, mode)
              const spec = getSkinSpec(item.id)
              const active = skin === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setSkin(item.id)}
                  className="text-left border p-4 transition"
                  style={{
                    borderRadius: 'var(--pg-radius)',
                    borderColor: active ? tokens.accent : 'var(--pg-border)',
                    background: 'var(--pg-panel)',
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
                    {[tokens.bg, tokens.panel, tokens.accent, tokens.edgeActive, tokens.edgeConflict].map((color) => (
                      <span key={color} className="w-6 h-6" style={{ background: color, borderRadius: 'calc(var(--pg-radius) * 0.4)' }} />
                    ))}
                  </div>
                  {/* 形态预览：直接用这套皮肤自己的形状参数画一个小元件，不用切换全局皮肤 */}
                  <div className="mb-3 p-2" style={{ background: tokens.bg, borderRadius: 'calc(' + tokens.radius + ' * 0.6)' }}>
                    <div
                      className="flex items-center"
                      style={{
                        gap: spec.shape.nodeStyle === 'terminal' ? 6 : 10,
                        background: tokens.panel,
                        border: spec.shape.borderWidth + 'px solid ' + tokens.border,
                        borderRadius: 'calc(' + tokens.radius + ' * ' + spec.shape.radiusScale + ')',
                        padding: Math.min(spec.shape.paddingY, 10) + 'px ' + Math.min(spec.shape.paddingX, 12) + 'px',
                        boxShadow: spec.shape.shadow === 'soft' ? tokens.canvasShadow : 'none',
                        fontFamily: tokens.fontFamily,
                      }}
                    >
                      {spec.shape.nodeStyle === 'terminal' ? (
                        <span style={{ width: 6, height: 6, borderRadius: 9999, background: tokens.accent, flexShrink: 0 }} />
                      ) : (
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            flexShrink: 0,
                            background: spec.shape.iconFrame === 'bare' ? 'transparent' : tokens.accentSoft,
                            borderRadius: spec.shape.iconFrame === 'circle' ? 9999 : 'calc(' + tokens.radius + ' * 0.5)',
                            border: '1px solid ' + tokens.border,
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        {spec.shape.showCaption && (
                          <div style={{ fontSize: 9, letterSpacing: '0.12em', color: tokens.muted }}>BUSBAR</div>
                        )}
                        <div style={{ fontSize: Math.min(spec.shape.titleSize, 13), fontWeight: 700, color: tokens.text }}>
                          母线段
                        </div>
                        <div style={{ fontSize: 10, color: tokens.muted }}>380 V</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                    {item.description}
                  </p>
                  <p className="text-[10px] mt-2" style={{ color: 'var(--pg-muted)' }}>
                    形态 {spec.shape.nodeStyle === 'card' ? '整卡' : spec.shape.nodeStyle === 'compact' ? '紧凑条' : '端子式'} · 连线 {spec.wire.width}px · 3D {spec.view3d.material}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">元件符号集</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SYMBOL_LIST.map((item) => {
              const active = symbolSet === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setSymbolSet(item.id)}
                  className="text-left border p-4 transition"
                  style={{
                    borderRadius: 'var(--pg-radius)',
                    borderColor: active ? 'var(--pg-accent)' : 'var(--pg-border)',
                    background: active ? 'var(--pg-accent-soft)' : 'var(--pg-panel)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{item.name}</span>
                    {active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--pg-accent)', color: '#fff' }}>
                        使用中
                      </span>
                    )}
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
          皮肤覆盖画布、网格、连线、面板卡片、字体与圆角；元件符号集决定母排、开关、变压器、电机的画法。
          元件本体的语义色（带电=绿、失电=灰、冲突=红）在所有皮肤与符号集下保持固定，避免含义漂移。
        </div>
      </div>
    </div>
  )
}