import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={cn('bg-card rounded-2xl shadow-sm border border-surface/50 p-6', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-xl font-bold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
