'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import * as React from 'react'

export const ThemeProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => {
  return (
    <NextThemesProvider enableColorScheme={false} storageKey="discuno-theme" {...props}>
      {children}
    </NextThemesProvider>
  )
}
