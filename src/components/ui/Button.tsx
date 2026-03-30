'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'lg',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-2xl focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none'

  const variants = {
    primary:
      'bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 hover:brightness-110 active:scale-[0.97] focus:ring-brand/30',
    secondary:
      'bg-white text-foreground border border-surface hover:bg-surface-light hover:border-surface active:scale-[0.98] shadow-sm focus:ring-surface/40',
    danger:
      'bg-gradient-to-b from-danger to-red-600 text-white shadow-lg shadow-danger/25 hover:shadow-xl hover:shadow-danger/30 hover:brightness-110 active:scale-[0.97] focus:ring-danger/30',
    ghost:
      'bg-transparent text-foreground hover:bg-surface-light/80 active:scale-[0.98] focus:ring-surface/30',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm gap-1.5',
    md: 'px-5 py-2.5 text-base gap-2',
    lg: 'px-7 py-3.5 text-lg gap-2',
  }

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  )
}
