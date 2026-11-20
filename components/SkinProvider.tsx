'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getSkinTokens, skinVars } from '@/lib/skins/tokens'
import type { SkinId, SkinMode, SkinTokens } from '@/lib/skins/tokens'

const SKIN_KEY = 'pg.skin'
const MODE_KEY = 'pg.mode'

type SkinContextValue = {
  skin: SkinId
  mode: SkinMode
  tokens: SkinTokens
  setSkin: (skin: SkinId) => void
  setMode: (mode: SkinMode) => void
}

const SkinContext = createContext<SkinContextValue | null>(null)

export const isSkinId = (value: string | null): value is SkinId =>
  value === 'industrial' || value === 'schematic' || value === 'paper'

export const isSkinMode = (value: string | null): value is SkinMode => value === 'light' || value === 'dark'

export function applySkinToDocument(skin: SkinId, mode: SkinMode) {
  const tokens = getSkinTokens(skin, mode)
  const root = document.documentElement
  root.setAttribute('data-skin', skin)
  root.setAttribute('data-mode', mode)
  const vars = skinVars(tokens)
  Object.keys(vars).forEach((key) => root.style.setProperty(key, vars[key]))
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<SkinId>('industrial')
  const [mode, setModeState] = useState<SkinMode>('light')

  useEffect(() => {
    const storedSkin = window.localStorage.getItem(SKIN_KEY)
    const storedMode = window.localStorage.getItem(MODE_KEY)
    const nextSkin = isSkinId(storedSkin) ? storedSkin : 'industrial'
    const nextMode = isSkinMode(storedMode) ? storedMode : 'light'
    setSkinState(nextSkin)
    setModeState(nextMode)
    applySkinToDocument(nextSkin, nextMode)
  }, [])

  const value = useMemo<SkinContextValue>(() => {
    const tokens = getSkinTokens(skin, mode)
    return {
      skin,
      mode,
      tokens,
      setSkin: (next) => {
        setSkinState(next)
        window.localStorage.setItem(SKIN_KEY, next)
        applySkinToDocument(next, mode)
      },
      setMode: (next) => {
        setModeState(next)
        window.localStorage.setItem(MODE_KEY, next)
        applySkinToDocument(skin, next)
      },
    }
  }, [skin, mode])

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const context = useContext(SkinContext)
  if (!context) throw new Error('useSkin 必须在 SkinProvider 内使用')
  return context
}