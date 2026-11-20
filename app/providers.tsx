'use client'

import { SessionProvider } from 'next-auth/react'
import { SkinProvider } from '@/components/SkinProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SkinProvider>{children}</SkinProvider>
    </SessionProvider>
  )
}