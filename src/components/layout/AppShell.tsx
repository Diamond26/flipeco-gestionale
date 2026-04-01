'use client'

import { useState, useEffect } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import Sidebar from '@/components/layout/Sidebar'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  pageTitle?: string
}

export default function AppShell({ children, pageTitle }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main content area — offset by sidebar width on md+ */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center gap-4 bg-background/70 backdrop-blur-xl border-b border-surface/30 px-6 py-4">
          {/* Hamburger — visible only on mobile */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden text-foreground/60 hover:text-brand"
            aria-label="Apri menu di navigazione"
            aria-expanded={mobileSidebarOpen}
            aria-controls="main-sidebar"
          >
            <Menu size={24} />
          </button>

          {/* Page title */}
          {pageTitle && (
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {pageTitle}
            </h1>
          )}

          {/* Theme toggle */}
          <div className="ml-auto">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-xl bg-surface-light/60 hover:bg-surface-light text-foreground/60 hover:text-foreground"
                aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
