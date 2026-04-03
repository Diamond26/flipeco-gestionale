'use client'

import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useCallback, useEffect } from 'react'

interface ConfirmBannerProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export function ConfirmBanner({
  open,
  onConfirm,
  onCancel,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  variant = 'default',
  loading = false,
}: ConfirmBannerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    },
    [onCancel],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  const iconColor =
    variant === 'danger'
      ? 'text-danger'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-brand'

  const confirmStyles =
    variant === 'danger'
      ? 'bg-gradient-to-b from-danger to-red-600 text-white shadow-lg shadow-danger/25 hover:shadow-xl hover:shadow-danger/30 hover:brightness-110'
      : variant === 'warning'
        ? 'bg-gradient-to-b from-warning to-amber-600 text-white shadow-lg shadow-warning/25 hover:shadow-xl hover:shadow-warning/30 hover:brightness-110'
        : 'bg-gradient-to-b from-brand to-brand-dark text-white shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 hover:brightness-110'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Banner */}
      <div className="confirm-banner relative mt-6 mx-4 w-full max-w-lg bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/15 border border-surface/50 dark:border-white/[0.08] overflow-hidden">
        {/* Colored top accent */}
        <div
          className={`h-1 w-full ${
            variant === 'danger'
              ? 'bg-gradient-to-r from-danger to-red-600'
              : variant === 'warning'
                ? 'bg-gradient-to-r from-warning to-amber-600'
                : 'bg-gradient-to-r from-brand to-brand-dark'
          }`}
        />

        <div className="px-6 py-5">
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-1.5 rounded-xl hover:bg-surface-light/80 cursor-pointer"
          >
            <X className="w-4 h-4 text-foreground/60 dark:text-foreground/40" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 mt-0.5 p-2 rounded-xl ${
                variant === 'danger'
                  ? 'bg-danger/10'
                  : variant === 'warning'
                    ? 'bg-warning/10'
                    : 'bg-brand/10'
              }`}
            >
              {variant === 'danger' || variant === 'warning' ? (
                <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
              ) : (
                <CheckCircle2 className={`w-5 h-5 ${iconColor}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-foreground tracking-wide uppercase mb-1">
                Conferma azione
              </h4>
              <p className="text-sm text-foreground/80 dark:text-foreground/70 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-5">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-card text-foreground border border-surface hover:bg-surface-light hover:border-surface active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2.5 text-sm font-semibold rounded-xl active:scale-[0.97] cursor-pointer disabled:opacity-50 ${confirmStyles}`}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {confirmLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
