'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validators/schemas'
import { Loader2, Check } from 'lucide-react'
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
  const [success, setSuccess] = useState(false)

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

    setSuccess(true)
    setTimeout(() => {
      router.push('/dashboard')
    }, 1500)
  }

  return (
    <main className="login-bg relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Animated aurora blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#7BB35F]/20 blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full bg-[#5a8a42]/15 blur-[100px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] rounded-full bg-[#8EC775]/10 blur-[80px] animate-[pulse_12s_ease-in-out_infinite_4s]" />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-[360px] animate-scale-in z-10">
        <div className="login-glass rounded-3xl px-7 py-7">

          {/* Logo */}
          <div className="flex flex-col items-center mb-2">
            <div className="relative w-72 h-28 transition-transform duration-500 hover:scale-105">
              <Image
                src="/logo.png"
                alt="Flip&Co logo"
                fill
                className="object-contain drop-shadow-xl"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <h1 className="text-[28px] font-bold text-white tracking-tight leading-none">
              Accedi
            </h1>
            <p className="text-xs font-semibold text-white/40 mt-1.5 uppercase tracking-[0.25em]">
              Gestionale
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 mb-4" />

          {/* Form / Success Animation */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 bg-[#7BB35F]/20 rounded-full flex items-center justify-center mb-5 animate-scale-in">
                <Check className="w-10 h-10 text-[#7BB35F] animate-slide-up" style={{ animationDelay: '150ms' }} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2 animate-slide-up" style={{ animationDelay: '300ms' }}>
                Accesso Eseguito
              </h2>
              <p className="text-sm text-white/50 animate-fade-in" style={{ animationDelay: '450ms' }}>
                Apertura gestionale in corso...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="nome@esempio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="login-input"
                />
                {errors.email && (
                  <p className="mt-1.5 text-sm text-red-400 font-medium">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="La tua password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="login-input"
                />
                {errors.password && (
                  <p className="mt-1.5 text-sm text-red-400 font-medium">{errors.password}</p>
                )}
              </div>

              {/* General error */}
              {errors.general && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/20 text-sm text-red-400 font-medium animate-slide-down"
                >
                  {errors.general}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn mt-1 w-full py-3.5 rounded-2xl text-lg font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {loading ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </form>
          )}


        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/30 mt-6">
          Accesso riservato al personale autorizzato
        </p>
      </div>
    </main>
  )
}
