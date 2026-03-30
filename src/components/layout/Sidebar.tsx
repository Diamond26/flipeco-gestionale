'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Package,
  ShoppingBag,
  Truck,
  CreditCard,
  LogOut,
  Menu,
  X,
  History,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Import Fornitori', icon: Upload, href: '/import' },
  { label: 'Storico Importazioni', icon: History, href: '/import-history' },
  { label: 'Magazzino', icon: Package, href: '/inventory' },
  { label: 'Ordini Clienti', icon: ShoppingBag, href: '/customer-orders' },
  { label: 'Ordini Acquisto', icon: Truck, href: '/purchase-orders' },
  { label: 'Cassa / POS', icon: CreditCard, href: '/pos' },
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

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 flex h-full w-64 flex-col glass-dark transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Navigazione principale"
      >
        {/* Header: Brand name */}
        <div className="flex items-center justify-center px-4 py-6 border-b border-white/[0.06] relative">
          <span className="text-white font-bold text-3xl tracking-wide">
            Flip<span className="text-brand-light">&amp;</span>Co
          </span>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="absolute right-4 text-white/40 hover:text-white md:hidden"
            aria-label="Chiudi menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1" aria-label="Menu principale">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl py-3 px-4 text-[15px] font-medium relative overflow-hidden',
                  isActive
                    ? 'bg-brand/20 text-white'
                    : 'text-white/60 hover:bg-white/[0.06] hover:text-white/90'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-brand-light" />
                )}
                <Icon
                  size={20}
                  className={cn(
                    'shrink-0',
                    isActive ? 'text-brand-light' : 'text-white/40 group-hover:text-white/70'
                  )}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl py-3 px-4 text-[15px] font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/80"
          >
            <LogOut size={20} className="text-white/30 group-hover:text-white/60" aria-hidden="true" />
            <span>Esci</span>
          </button>
        </div>
      </aside>
    </>
  )
}
