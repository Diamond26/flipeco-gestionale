'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-foreground/80 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-3 text-base rounded-xl border border-surface/80 bg-card shadow-sm',
            'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
            'placeholder:text-foreground/30',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-danger font-medium">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
