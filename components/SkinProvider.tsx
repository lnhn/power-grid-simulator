'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getSkinTokens, skinVars } from '@/lib/skins/tokens'
import { getSkinSpec, type SkinSpec } from '@/lib/skins/spec'
import type { SkinId, SkinMode, SkinTokens, SymbolSet } from '@/lib/skins/tokens'

const SKIN_KEY = 'pg.skin'
const MODE_KEY = 'pg.mode'
const SYMBOL_KEY = 'pg.symbol'

type SkinContextValue = {
  skin: SkinId
  mode: SkinMode
  symbolSet: SymbolSet
  tokens: SkinTokens
  /** 皮肤规格：形态、连线、3D 材质，与配色同一处读取 */
  spec: SkinSpec
  setSkin: (skin: SkinId) => void
  setMode: (mode: SkinMode) => void
  setSymbolSet: (symbolSet: SymbolSet) => void
}

const SkinContext = createContext<SkinContextValue | null>(null)

const SKIN_IDS: SkinId[] = ['industrial', 'schematic', 'paper', 'terminal']

export const isSkinId = (value: string | null): value is SkinId =>
  value !== null && (SKIN_IDS as string[]).includes(value)

export const isSkinMode = (value: string | null): value is SkinMode => value === 'light' || value === 'dark'

export const isSymbolSet = (value: string | null): value is SymbolSet =>
  value === 'iec' || value === 'gb' || value === 'simple'

export function applySkinToDocument(skin: SkinId, mode: SkinMode, symbolSet: SymbolSet = 'iec') {
  const tokens = getSkinTokens(skin, mode)
  const root = document.documentElement
  root.setAttribute('data-skin', skin)
  root.setAttribute('data-mode', mode)
  root.setAttribute('data-symbol', symbolSet)
  const vars = skinVars(tokens)
  Object.keys(vars).forEach((key) => root.style.setProperty(key, vars[key]))
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<SkinId>('industrial')
  const [mode, setModeState] = useState<SkinMode>('light')
  const [symbolSet, setSymbolSetState] = useState<SymbolSet>('iec')

  useEffect(() => {
    const storedSkin = window.localStorage.getItem(SKIN_KEY)
    const storedMode = window.localStorage.getItem(MODE_KEY)
    const storedSymbol = window.localStorage.getItem(SYMBOL_KEY)
    const nextSkin = isSkinId(storedSkin) ? storedSkin : 'industrial'
    const nextMode = isSkinMode(storedMode) ? storedMode : 'light'
    const nextSymbol = isSymbolSet(storedSymbol) ? storedSymbol : 'iec'
    setSkinState(nextSkin)
    setModeState(nextMode)
    setSymbolSetState(nextSymbol)
    applySkinToDocument(nextSkin, nextMode, nextSymbol)
  }, [])

  const value = useMemo<SkinContextValue>(() => {
    const tokens = getSkinTokens(skin, mode)
    return {
      skin,
      mode,
      symbolSet,
      tokens,
      spec: getSkinSpec(skin),
      setSkin: (next) => {
        setSkinState(next)
        window.localStorage.setItem(SKIN_KEY, next)
        applySkinToDocument(next, mode, symbolSet)
      },
      setMode: (next) => {
        setModeState(next)
        window.localStorage.setItem(MODE_KEY, next)
        applySkinToDocument(skin, next, symbolSet)
      },
      setSymbolSet: (next) => {
        setSymbolSetState(next)
        window.localStorage.setItem(SYMBOL_KEY, next)
        applySkinToDocument(skin, mode, next)
      },
    }
  }, [skin, mode, symbolSet])

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>
}

export function useSkin() {
  const context = useContext(SkinContext)
  if (!context) throw new Error('useSkin 必须在 SkinProvider 内使用')
  return context
}