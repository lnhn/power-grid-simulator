'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GridNode } from '@/lib/grid'
import { useSkin } from '@/components/SkinProvider'
import { SymbolIcon } from './SymbolIcon'

/** 语义色：闭合=绿、断开=红（运行视图沿用原有强对比），端口带电=蓝 */
const CLOSED = '#16a34a'
const OPEN = '#dc2626'
const PORT_LIVE = '#2563eb'
const PORT_DEAD = '#94a3b8'

export const SimulateSwitchNode = memo(({ data, id }: NodeProps<GridNode>) => {
  const { tokens } = useSkin()
  const isOn = data.status === 'on'
  const isPowered = data.powered
  const isTie = data.subType === 'tie'
  const portStatus = data.portStatus || {}
  const topPowered = portStatus.top ?? isPowered
  const bottomPowered = portStatus.bottom ?? isPowered
  const leftPowered = portStatus.left ?? isPowered
  const rightPowered = portStatus.right ?? isPowered

  const tieMode = data.tieMode as string | undefined
  const tieBadge =
    tieMode === 'parallel'
      ? { text: '母联 · 并列', bg: '#dbeafe', fg: '#1d4ed8' }
      : tieMode === 'unsafeParallel'
        ? { text: '母联 · 危险并列', bg: '#fee2e2', fg: '#b91c1c' }
        : tieMode === 'sectioned'
          ? { text: '母联 · 分段', bg: '#dcfce7', fg: '#15803d' }
          : tieMode === 'standby'
            ? { text: '母联 · 备用', bg: '#fef3c7', fg: '#b45309' }
            : { text: '母联', bg: '#dcfce7', fg: '#15803d' }

  const previewLines: string[] =
    isTie && typeof data.onPreview === 'function' ? data.onPreview(id, !isOn) : []
  const previewText = previewLines.length > 0 ? '\n\n▲ 预计结果\n' + previewLines.join('\n') : ''

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = isOn ? '断开' : '闭合'
    const device = isTie ? '母联' : '断路器'
    const message =
      `当前状态: ${isOn ? '闭合' : '断开'}\n` +
      `操作后: ${newStatus}` +
      (isTie ? '\n母联为双向联络开关' : '')

    if (typeof data.onRequestConfirm === 'function') {
      data.onRequestConfirm({
        title: '操作确认',
        message: `确认要${newStatus}${device} "${data.label}" 吗？\n\n${message}${previewText}`,
        onConfirm: () => data.onToggle?.(id),
      })
    } else if (data.onToggle) {
      data.onToggle(id)
    }
  }

  const handle = (powered: boolean) => ({
    width: 14,
    height: 14,
    background: powered ? PORT_LIVE : PORT_DEAD,
    border: '2px solid var(--pg-panel)',
    pointerEvents: 'none' as const,
  })

  return (
    <div
      onClick={handleClick}
      className="relative px-5 py-3 min-w-[240px] border-2 cursor-pointer transition-all duration-300"
      style={{
        background: 'var(--pg-panel)',
        borderColor: isOn ? CLOSED : OPEN,
        borderRadius: 'var(--pg-radius)',
        boxShadow: tokens.canvasShadow,
        fontFamily: 'var(--pg-font)',
        pointerEvents: 'all',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="p-1.5"
            style={{ background: isOn ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.10)', borderRadius: 'calc(var(--pg-radius) * 0.6)' }}
          >
            <SymbolIcon kind="switch" on={isOn} tie={isTie} color={isOn ? CLOSED : OPEN} />
          </span>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--pg-text)' }}>{data.label}</div>
            <div className="text-xs font-bold" style={{ color: isOn ? CLOSED : OPEN }}>
              {isOn ? '● 闭合' : '○ 断开'}
            </div>
          </div>
        </div>
        {isTie && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tieBadge.bg, color: tieBadge.fg }}>
            {tieBadge.text}
          </span>
        )}
      </div>

      {!isTie ? (
        <>
          <Handle type="target" position={Position.Top} style={{ ...handle(topPowered), top: -8 }} />
          <Handle type="source" position={Position.Bottom} style={{ ...handle(bottomPowered), bottom: -8 }} />
        </>
      ) : (
        <>
          <Handle id="left-target" type="target" position={Position.Left} style={{ ...handle(leftPowered), left: -8 }} />
          <Handle id="left-source" type="source" position={Position.Left} style={{ ...handle(leftPowered), left: -8 }} />
          <Handle id="right-target" type="target" position={Position.Right} style={{ ...handle(rightPowered), right: -8 }} />
          <Handle id="right-source" type="source" position={Position.Right} style={{ ...handle(rightPowered), right: -8 }} />
        </>
      )}
    </div>
  )
})

SimulateSwitchNode.displayName = 'SimulateSwitchNode'