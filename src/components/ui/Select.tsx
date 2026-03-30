'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-semibold text-foreground/80 mb-1.5">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'w-full px-4 py-3 text-base rounded-xl border border-surface/80 bg-white shadow-sm appearance-none',
            'focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-md',
            'cursor-pointer',
            error && 'border-danger focus:border-danger focus:ring-danger/15',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-sm text-danger font-medium">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'
