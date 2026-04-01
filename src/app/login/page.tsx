'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validators/schemas'
import type { ZodError } from 'zod'

interface FormErrors {
  email?: string
  password?: string
  general?: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const result = loginSchema.safeParse({ email, password })

    if (!result.success) {
      const fieldErrors: FormErrors = {}
      for (const issue of (result.error as ZodError).issues) {
        const field = issue.path[0] as keyof FormErrors
        if (field === 'email' || field === 'password') {
          fieldErrors[field] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    })

    if (error) {
      setLoading(false)
      if (error.message.toLowerCase().includes('invalid')) {
        setErrors({ general: 'Email o password non corretti.' })
      } else {
        setErrors({ general: 'Errore durante il login. Riprova.' })
      }
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-surface-light to-background flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Card */}
        <div className="bg-card/90 backdrop-blur-xl rounded-3xl shadow-xl shadow-black/[0.08] border border-white/60 dark:border-white/[0.08] px-8 py-10">

          {/* Logo and brand header */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative w-20 h-20">
              <Image
                src="/logo.png"
                alt="Flip&Co logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Flip<span className="text-brand">&</span>Co
              </h1>
              <p className="text-sm font-medium text-foreground/40 mt-0.5 uppercase tracking-widest">
                Gestionale
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-surface/40 mb-8" />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="nome@esempio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={loading}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="La tua password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={loading}
            />

            {/* General error */}
            {errors.general && (
              <div
                role="alert"
                className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger font-medium animate-slide-down"
              >
                {errors.general}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-1"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-foreground/35 mt-6">
          Accesso riservato al personale autorizzato
        </p>
      </div>
    </main>
  )
}
