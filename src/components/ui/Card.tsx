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
        'bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm shadow-black/[0.04] border border-white/60 p-6',
        'animate-fade-in',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-5">
          {title && <h2 className="text-xl font-bold text-foreground">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
