'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validators/schemas'
import { Loader2, Check, Mail, Lock } from 'lucide-react'
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

      {/* Aurora blobs — dark mode vivid, light mode soft */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="login-blob-1 absolute top-[-15%] right-[-8%] w-[650px] h-[650px] rounded-full blur-[130px] animate-[pulse_9s_ease-in-out_infinite]" />
        <div className="login-blob-2 absolute bottom-[-10%] left-[-5%] w-[550px] h-[550px] rounded-full blur-[110px] animate-[pulse_11s_ease-in-out_infinite_2s]" />
        <div className="login-blob-3 absolute top-[35%] left-[15%] w-[350px] h-[350px] rounded-full blur-[90px] animate-[pulse_13s_ease-in-out_infinite_4s]" />
      </div>

      {/* Noise grain texture overlay */}
      <div className="login-grain absolute inset-0 pointer-events-none opacity-[0.025]" aria-hidden="true" />

      {/* Glass card */}
      <div className="relative w-full max-w-[380px] animate-scale-in z-10">
        <div className="login-glass rounded-[28px] px-8 py-9 flex flex-col gap-0">

          {/* ── Logo block ── */}
          <div className="flex flex-col items-center gap-3 mb-6">

            {/* Icon */}
            <div className="transition-transform duration-500 hover:scale-105 drop-shadow-xl">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect x="1" y="1" width="54" height="54" rx="14" className="login-icon-bg" strokeWidth="1.3"/>
                <path d="M16 15h20M16 28h14M16 15v28" className="login-icon-stroke" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <text x="31" y="43" fontSize="13" className="login-icon-amp" fontFamily="Georgia, serif" fontStyle="italic" textAnchor="start">&amp;</text>
              </svg>
            </div>

            {/* Wordmark */}
            <svg width="130" height="30" viewBox="0 0 130 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Flip&amp;Co">
              <text x="65" y="23" textAnchor="middle" fontSize="23" fontWeight="600" letterSpacing="0.4" className="login-wordmark-main" fontFamily="Georgia, serif">
                Flip<tspan className="login-wordmark-amp">&amp;</tspan>Co
              </text>
            </svg>

            {/* Accedi */}
            <div className="flex flex-col items-center gap-1 mt-1">
              <h1 className="login-title text-[15px] font-bold uppercase tracking-[0.3em]">
                Accedi
              </h1>
              <div className="login-title-line w-8 h-[2px] rounded-full" />
            </div>
          </div>

          {/* Divider */}
          <div className="login-divider mb-6" />

          {/* ── Form / Success ── */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center animate-scale-in" style={{ background: 'rgba(123,179,95,0.15)', border: '1.5px solid rgba(123,179,95,0.3)' }}>
                <Check className="w-10 h-10 text-[#7BB35F] animate-slide-up" style={{ animationDelay: '150ms' }} />
              </div>
              <div className="text-center">
                <h2 className="login-success-title text-xl font-bold mb-1 animate-slide-up" style={{ animationDelay: '300ms' }}>
                  Accesso Eseguito
                </h2>
                <p className="login-success-sub text-sm animate-fade-in" style={{ animationDelay: '450ms' }}>
                  Apertura gestionale in corso...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="login-label text-[11px] font-bold uppercase tracking-[0.2em]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="login-input-icon absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="nome@esempio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="login-input pl-11"
                  />
                </div>
                {errors.email && (
                  <p className="text-[12px] text-red-400 font-medium mt-0.5">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label className="login-label text-[11px] font-bold uppercase tracking-[0.2em]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="login-input-icon absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="login-input pl-11"
                  />
                </div>
                {errors.password && (
                  <p className="text-[12px] text-red-400 font-medium mt-0.5">{errors.password}</p>
                )}
              </div>

              {/* General error */}
              {errors.general && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl text-[13px] font-medium animate-slide-down"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                >
                  {errors.general}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn mt-2 w-full py-4 rounded-2xl text-[15px] font-bold tracking-widest text-white flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Accesso in corso...</>
                ) : (
                  'Accedi'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="login-footer text-center text-[10px] font-semibold uppercase tracking-[0.2em] mt-5">
          Accesso riservato al personale autorizzato
        </p>
      </div>
    </main>
  )
}
