'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Archive,
  ClipboardList,
  ShoppingCart,
  Box,
  LogOut,
  X,
  History,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  icon: React.ElementType
  href: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Import Fornitori', icon: Upload, href: '/import' },
  { label: 'Storico Importazioni', icon: History, href: '/import-history' },
  { label: 'Magazzino', icon: Archive, href: '/inventory' },
  { label: 'Ordini Clienti', icon: ClipboardList, href: '/customer-orders' },
  { label: 'Ordini Acquisto', icon: ShoppingCart, href: '/purchase-orders' },
  { label: 'Cassa / POS', icon: Box, href: '/pos' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isItemActive = (item: NavItem): boolean => {
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-30 flex h-full w-[280px] flex-col bg-white dark:bg-[#0f1219] border-r border-surface/40 dark:border-transparent transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Navigazione principale"
      >
        {/* Logo Replicato dall'immagine */}
        <div className="flex items-center gap-3.5 px-7 py-8 relative">
          <div className="relative flex items-center justify-center w-11 h-11">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              className="text-[#7BB35F] drop-shadow-[0_0_6px_rgba(123,179,95,0.7)] drop-shadow-[0_0_2px_rgba(123,179,95,0.9)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 28 42
                   C 38 25, 70 12, 85 15
                   L 82 25
                   C 65 25, 52 30, 48 38
                   L 46 45
                   C 65 42, 75 38, 80 40
                   L 76 50
                   C 62 50, 52 52, 48 60
                   V 85
                   C 48 89, 38 89, 38 85
                   V 65
                   C 22 62, 22 48, 38 45
                   L 40 38
                   C 34 38, 31 40, 28 42
                   Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-gray-900 dark:text-white font-bold text-[26px] tracking-wide ml-1">
            Flip&amp;Co
          </span>
          <button
            onClick={onMobileClose}
            className="absolute right-4 text-gray-400 hover:text-gray-700 dark:text-white/40 dark:hover:text-white md:hidden"
            aria-label="Chiudi menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-2 mt-2" aria-label="Menu principale">
          {navItems.map((item) => {
            const isActive = isItemActive(item)

            return (
              <div key={item.href} className="relative group">
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl py-3.5 px-4 text-[15px] font-medium transition-all duration-300 w-full overflow-hidden relative',
                    isActive
                      ? 'text-[#7BB35F] bg-gradient-to-r from-[#7BB35F]/5 dark:from-transparent to-[#7BB35F]/15 border border-[#7BB35F]/40 shadow-[0_0_15px_rgba(123,179,95,0.1)]'
                      : 'text-foreground/60 dark:text-white/70 hover:text-foreground dark:hover:text-white hover:bg-surface-light/50 dark:hover:bg-white/[0.03] border border-transparent'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon
                    size={22}
                    strokeWidth={isActive ? 2 : 1.5}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-[#7BB35F] drop-shadow-[0_0_5px_rgba(123,179,95,0.3)] dark:drop-shadow-[0_0_5px_rgba(123,179,95,0.5)]' : 'text-foreground/40 dark:text-white/60 group-hover:text-foreground/70 dark:group-hover:text-white/80'
                    )}
                    aria-hidden="true"
                  />
                  <span className={cn('flex-1 tracking-wide', isActive ? 'drop-shadow-[0_0_4px_rgba(123,179,95,0.2)] dark:drop-shadow-[0_0_4px_rgba(123,179,95,0.3)]' : '')}>
                    {item.label}
                  </span>

                  {/* Active glowing right bar */}
                  {isActive && (
                    <span className="absolute right-0 top-0 bottom-0 w-[4px] bg-[#7BB35F] rounded-l-full shadow-[0_0_12px_rgba(123,179,95,0.9)]" />
                  )}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-5 py-6">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-4 rounded-2xl py-3 px-4 text-[15px] font-medium text-foreground/50 dark:text-white/50 hover:text-foreground dark:hover:text-white/80 transition-colors hover:bg-surface-light/50 dark:hover:bg-white/[0.03]"
          >
            <LogOut size={22} strokeWidth={1.5} className="text-foreground/30 dark:text-white/40 group-hover:text-foreground/60 dark:group-hover:text-white/60" aria-hidden="true" />
            <span className="tracking-wide">Esci</span>
          </button>
        </div>
      </aside>
    </>
  )
}

