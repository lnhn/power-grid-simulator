'use client'

import type { ReactNode } from 'react'
import { useSkin } from '@/components/SkinProvider'
import { LiveBadge, liveBorderColor, type BadgeKind, type LiveView } from './LiveBadge'

/**
 * 元件卡片的统一外壳（NodeShell）。
 *
 * 五类元件此前各自写了一套 padding / 圆角 / 图标底板 / 删除按钮，
 * 换皮肤要改五遍。现在外表统一由这里按 SkinSpec.shape 渲染，
 * 元件只负责"身体"：图标、名称、副标题、右侧角标与端口（Handle）。
 *
 * 语义色仍然优先于皮肤：带电绿 / 失电灰 / 冲突红由 live 决定，皮肤只能改其余部分。
 */
export type NodeShellProps = {
  selected?: boolean
  live?: LiveView
  liveKind: BadgeKind
  /** 元件自定义语义描边（开关：闭合绿 / 断开灰）；缺省走 live 或皮肤描边 */
  tone?: string
  /** 标题与副标题 */
  title: ReactNode
  subtitle?: ReactNode
  /** 副标题上方的一行小字（如 schematic 的 BUSBAR / 端子式的编号） */
  caption?: ReactNode
  icon: ReactNode
  /** 图标底板强调色（默认用皮肤 accent） */
  iconTone?: string
  /** 图标底板底色（开关闭合/断开等需要跟着状态变底色） */
  iconBackground?: string
  /** 副标题颜色（开关"闭合/断开"要带语义色） */
  subtitleTone?: string
  /** 右侧角标：运行 / 母联 / 停运 */
  badge?: ReactNode
  onDelete?: () => void
  /** 端口（Handle）由元件自己放进 children，避免外壳猜端口位置 */
  children?: ReactNode
}

export function NodeShell({
  selected,
  live,
  liveKind,
  tone,
  title,
  subtitle,
  caption,
  icon,
  iconTone,
  iconBackground,
  subtitleTone,
  badge,
  onDelete,
  children,
}: NodeShellProps) {
  const { tokens, spec, mode } = useSkin()
  const shape = spec.shape
  const liveBorder = liveBorderColor(live)
  const borderColor = liveBorder ?? (selected ? tokens.accent : tone ?? 'var(--pg-panel-border)')

  const iconBoxStyle: React.CSSProperties =
    shape.iconFrame === 'bare'
      ? { color: iconTone ?? tokens.accent }
      : shape.iconFrame === 'circle'
        ? {
            background: tokens.accentSoft,
            borderRadius: '9999px',
            padding: 6,
            color: iconTone ?? tokens.accent,
          }
        : {
            background: iconBackground ?? (iconTone ? `${iconTone}1f` : tokens.accentSoft),
            borderRadius: `calc(var(--pg-radius) * 0.6)`,
            padding: 6,
            color: iconTone ?? tokens.accent,
          }

  // 端子式：不显示图标、只留状态点，信息密度最高
  const compactTerminal = shape.nodeStyle === 'terminal'

  return (
    <div
      className="relative flex items-center"
      style={{
        gap: compactTerminal ? 6 : 12,
        justifyContent: 'space-between',
        minWidth: shape.minWidth,
        padding: `${shape.paddingY}px ${shape.paddingX}px`,
        background: compactTerminal ? `color-mix(in srgb, var(--pg-panel) ${mode === 'dark' ? '92%' : '100%'}, transparent)` : 'var(--pg-panel)',
        borderColor,
        borderWidth: shape.borderWidth,
        borderStyle: 'solid',
        borderRadius: `calc(var(--pg-radius) * ${shape.radiusScale})`,
        boxShadow: selected
          ? `0 0 0 3px ${tokens.accentSoft}`
          : shape.shadow === 'soft'
            ? tokens.canvasShadow
            : 'none',
        fontFamily: 'var(--pg-font)',
      }}
    >
      {live && <LiveBadge live={live} kind={liveKind} />}
      {selected && onDelete && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full shadow text-sm leading-none"
          style={{ background: 'var(--pg-panel)', border: '1px solid var(--pg-panel-border)', color: 'var(--pg-muted)' }}
          aria-label="删除节点"
        >
          ×
        </button>
      )}

      <div className="flex items-center min-w-0" style={{ gap: compactTerminal ? 6 : 12 }}>
        {compactTerminal ? (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '9999px',
              background: liveBorder ?? tone ?? tokens.accent,
              flexShrink: 0,
            }}
          />
        ) : (
          <span style={iconBoxStyle} className="flex items-center justify-center flex-shrink-0">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {caption && (
            <div className="text-[10px] tracking-widest truncate" style={{ color: 'var(--pg-muted)' }}>
              {caption}
            </div>
          )}
          <div
            className="truncate"
            style={{
              color: 'var(--pg-text)',
              fontSize: shape.titleSize,
              fontWeight: shape.nodeStyle === 'compact' ? 600 : 700,
              lineHeight: 1.35,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="truncate" style={{ color: subtitleTone ?? 'var(--pg-muted)', fontSize: shape.subtitleSize, lineHeight: 1.4, fontWeight: subtitleTone ? 500 : 400 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {badge}

      {children}
    </div>
  )
}
