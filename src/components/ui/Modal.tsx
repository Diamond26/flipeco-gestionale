'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`relative ${sizes[size]} w-full mx-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 max-h-[90vh] flex flex-col border border-white/50 animate-slide-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-surface/30">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-light/80 cursor-pointer"
          >
            <X className="w-5 h-5 text-foreground/50" />
          </button>
        </div>
        {/* Body */}
        <div className="px-7 py-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
