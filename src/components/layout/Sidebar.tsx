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
          'fixed top-0 left-0 z-30 flex h-full w-[260px] flex-col bg-[#0c1222] transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
        aria-label="Navigazione principale"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 relative">
          <Image
            src="/logo.png"
            alt="Flip&Co Logo"
            width={38}
            height={38}
            className="rounded-lg"
          />
          <span className="text-white font-bold text-[22px] tracking-tight">
            Flip<span className="text-brand-light">&amp;</span>Co
          </span>
          <button
            onClick={onMobileClose}
            className="absolute right-4 text-white/40 hover:text-white md:hidden"
            aria-label="Chiudi menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4 space-y-1" aria-label="Menu principale">
          {navItems.map((item) => {
            const isActive = isItemActive(item)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  'group flex items-center gap-3 rounded-xl py-2.5 px-4 text-[14px] font-medium relative',
                  isActive
                    ? 'bg-brand/15 text-white'
                    : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-brand" />
                )}
                <item.icon
                  size={19}
                  className={cn('shrink-0', isActive ? 'text-brand' : 'text-white/30 group-hover:text-white/60')}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl py-2.5 px-4 text-[14px] font-medium text-white/40 hover:bg-white/[0.05] hover:text-white/70"
          >
            <LogOut size={19} className="text-white/25 group-hover:text-white/50" aria-hidden="true" />
            <span>Esci</span>
          </button>
        </div>
      </aside>
    </>
  )
}
