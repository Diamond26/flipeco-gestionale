'use client'

import { useState, useEffect } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import Sidebar from '@/components/layout/Sidebar'

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
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="md:ml-[260px] flex flex-col min-h-screen">
        {/* Minimal top bar — only hamburger on mobile + theme toggle */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden text-foreground/60 hover:text-brand"
            aria-label="Apri menu di navigazione"
            aria-expanded={mobileSidebarOpen}
          >
            <Menu size={24} />
          </button>

          {/* Spacer on desktop */}
          <div className="hidden md:block" />

          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl bg-card/80 shadow-sm border border-white/50 dark:border-white/[0.06] text-foreground/50 hover:text-foreground"
              aria-label={theme === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
        </div>

        {/* Page content */}
        <main className="flex-1 px-6 pb-6" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
