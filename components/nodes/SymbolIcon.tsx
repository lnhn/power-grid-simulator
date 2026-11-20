'use client'

import { useSkin } from '@/components/SkinProvider'

export type SymbolKind = 'source' | 'bus' | 'switch' | 'transformer' | 'load'

type Props = {
  kind: SymbolKind
  /** 开关类：true=闭合；负荷类：true=运行 */
  on?: boolean
  /** 母联：IEC 图形上画成双联刀开关 */
  tie?: boolean
  color?: string
  size?: number
}

/**
 * 元件符号集：同一件设备在 IEC / 国标 / 简化 三套画法下的图形。
 * 语义色由调用方通过 color 传入（带电=绿、失电=灰、冲突=红），符号集只改形状。
 */
export function SymbolIcon({ kind, on = true, tie = false, color, size = 20 }: Props) {
  const { symbolSet, tokens } = useSkin()
  const stroke = color ?? tokens.text
  const common = { stroke, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

  const body = () => {
    if (kind === 'source') {
      if (symbolSet === 'gb') {
        return (
          <>
            <rect x="3.5" y="4" width="17" height="16" rx="1" {...common} />
            <circle cx="12" cy="12" r="4.2" {...common} />
            <path d="M12 8v8M8 12h8" {...common} />
          </>
        )
      }
      if (symbolSet === 'simple') {
        return <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" {...common} />
      }
      return (
        <>
          <circle cx="12" cy="12" r="8" {...common} />
          <path d="M6 9c2 3 4 3 6 0s4 -3 6 0M6 15c2 3 4 3 6 0s4 -3 6 0" {...common} strokeWidth={1.3} />
        </>
      )
    }

    if (kind === 'bus') {
      if (symbolSet === 'gb') {
        return (
          <>
            <rect x="2.5" y="9" width="19" height="6" rx="0.5" {...common} />
            <path d="M6 9v6M18 9v6" {...common} strokeWidth={1.1} />
          </>
        )
      }
      if (symbolSet === 'simple') {
        return <path d="M2.5 12h19" {...common} strokeWidth={2.6} />
      }
      return (
        <>
          <path d="M3 12h18" {...common} strokeWidth={2.6} />
          <path d="M6 9.5v5M12 9.5v5M18 9.5v5" {...common} strokeWidth={1.1} />
        </>
      )
    }

    if (kind === 'switch') {
      if (symbolSet === 'gb') {
        return (
          <>
            <rect x="4" y="8" width="16" height="8" rx="1" {...common} />
            <path d={on ? 'M8 12h8' : 'M8 12l8-4'} {...common} />
            {tie && <path d="M4 5h16" {...common} strokeWidth={1.1} />}
          </>
        )
      }
      if (symbolSet === 'simple') {
        return (
          <>
            <path d="M3 12h5M16 12h5" {...common} />
            <path d={on ? 'M8 12h8' : 'M8 13l8-5'} {...common} />
          </>
        )
      }
      return (
        <>
          <circle cx="4.5" cy="12" r="1.4" {...common} strokeWidth={1.3} />
          <circle cx="19.5" cy="12" r="1.4" {...common} strokeWidth={1.3} />
          <path d={on ? 'M7 12h10' : 'M7 12l10-5'} {...common} />
          {tie && <path d="M9 17l6-10" {...common} strokeWidth={1.2} />}
        </>
      )
    }

    if (kind === 'transformer') {
      if (symbolSet === 'gb') {
        return (
          <>
            <rect x="4" y="6" width="6.5" height="12" rx="0.5" {...common} />
            <rect x="13.5" y="6" width="6.5" height="12" rx="0.5" {...common} />
            <path d="M10.5 9.5h3M10.5 14.5h3" {...common} strokeWidth={1.2} />
          </>
        )
      }
      if (symbolSet === 'simple') {
        return (
          <>
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" {...common} />
            <path d="M10 12h4" {...common} strokeWidth={1.2} />
          </>
        )
      }
      return (
        <>
          <circle cx="8.5" cy="12" r="4" {...common} />
          <circle cx="15.5" cy="12" r="4" {...common} />
          <path d="M12 8v8" {...common} strokeWidth={1.1} />
        </>
      )
    }

    // load：电机画成圆里一个 M，简化版只画矩形与状态点
    if (symbolSet === 'simple') {
      return (
        <>
          <rect x="4" y="7" width="16" height="10" rx="1" {...common} />
          <circle cx="12" cy="12" r="1.6" fill={on ? stroke : 'none'} stroke={stroke} strokeWidth={1.2} />
        </>
      )
    }
    return (
      <>
        <circle cx="12" cy="12" r="7.5" {...common} />
        <path d="M8 15V9l4 4 4-4v6" {...common} strokeWidth={1.5} />
      </>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {body()}
    </svg>
  )
}