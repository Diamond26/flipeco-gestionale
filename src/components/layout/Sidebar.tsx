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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Import Fornitori', icon: Upload, href: '/import' },
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
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-30 flex h-full w-64 flex-col bg-sidebar transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Navigazione principale"
      >
        {/* Header: Logo + Brand name */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="relative h-8 w-8 shrink-0">
            <Image
              src="/logo.png"
              alt="Flip&Co logo"
              fill
              sizes="32px"
              className="object-contain"
              priority
            />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Flip&amp;Co</span>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="ml-auto text-white/60 hover:text-white md:hidden"
            aria-label="Chiudi menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu principale">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 rounded-xl py-3 px-4 text-lg font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-brand/20 text-brand-light border-l-4 border-brand-light pl-3'
                    : 'text-white/80 hover:bg-sidebar-hover hover:text-white border-l-4 border-transparent pl-3'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl py-3 px-4 text-lg font-medium text-white/70 hover:bg-sidebar-hover hover:text-white transition-colors duration-150 border-l-4 border-transparent pl-3"
          >
            <LogOut size={22} aria-hidden="true" />
            <span>Esci</span>
          </button>
        </div>
      </aside>
    </>
  )
}
