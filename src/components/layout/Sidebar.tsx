'use client'

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
  X,
  ChevronDown,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    label: 'Import Fornitori',
    icon: Upload,
    children: [
      { label: 'Importa', href: '/import' },
      { label: 'Storico Importazioni', href: '/import-history' },
    ],
  },
  {
    label: 'Magazzino',
    icon: Package,
    children: [
      { label: 'Inventario', href: '/inventory' },
    ],
  },
  {
    label: 'Ordini Clienti',
    icon: ShoppingBag,
    children: [
      { label: 'Lista Ordini', href: '/customer-orders' },
    ],
  },
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
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const isItemActive = (item: NavItem): boolean => {
    if (item.href) {
      return pathname === item.href || pathname.startsWith(item.href + '/')
    }
    if (item.children) {
      return item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
    }
    return false
  }

  // Auto-open menus with active children
  const getIsOpen = (item: NavItem): boolean => {
    if (openMenus[item.label] !== undefined) return openMenus[item.label]
    return isItemActive(item)
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
          'fixed top-0 left-0 z-30 flex h-full w-[260px] flex-col bg-[#0c1222] transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Navigazione principale"
      >
        {/* Header: Logo + Brand */}
        <div className="flex items-center gap-3 px-6 py-7 relative">
          <Image
            src="/logo.png"
            alt="Flip&Co Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-white font-bold text-2xl tracking-tight">
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
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" aria-label="Menu principale">
          {navItems.map((item) => {
            const isActive = isItemActive(item)
            const hasChildren = !!item.children
            const isOpen = hasChildren && getIsOpen(item)

            if (hasChildren) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl py-2.5 px-4 text-[15px] font-medium relative',
                      isActive
                        ? 'bg-brand/15 text-white'
                        : 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-brand" />
                    )}
                    <item.icon
                      size={20}
                      className={cn('shrink-0', isActive ? 'text-brand' : 'text-white/35 group-hover:text-white/65')}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        'shrink-0 transition-transform duration-200',
                        isOpen ? 'rotate-180' : '',
                        isActive ? 'text-white/60' : 'text-white/30'
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-7 pl-4 border-l border-white/[0.08] mt-1 mb-1 space-y-0.5">
                      {item.children!.map((child) => {
                        const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onMobileClose}
                            className={cn(
                              'block rounded-lg py-2 px-3 text-sm font-medium',
                              childActive
                                ? 'text-brand bg-brand/10'
                                : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'
                            )}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={onMobileClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl py-2.5 px-4 text-[15px] font-medium relative',
                  isActive
                    ? 'bg-brand/15 text-white'
                    : 'text-white/55 hover:bg-white/[0.05] hover:text-white/85'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-brand" />
                )}
                <item.icon
                  size={20}
                  className={cn('shrink-0', isActive ? 'text-brand' : 'text-white/35 group-hover:text-white/65')}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl py-2.5 px-4 text-[15px] font-medium text-white/45 hover:bg-white/[0.05] hover:text-white/75"
          >
            <LogOut size={20} className="text-white/30 group-hover:text-white/55" aria-hidden="true" />
            <span>Esci</span>
          </button>
        </div>
      </aside>
    </>
  )
}
