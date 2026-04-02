import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.06] p-6',
        'animate-fade-in',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-5">
          {title && <h2 className="text-lg font-bold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
