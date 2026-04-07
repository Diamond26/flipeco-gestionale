import React from 'react'
import { ShoppingCart, Minus, Plus, X, Banknote, CreditCard, RotateCcw } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { CartItem, PaymentMethod } from '../types'

interface POSCartProps {
  cart: CartItem[]
  cartTotal: number
  cartItemCount: number
  incrementQty: (id: string) => void
  decrementQty: (id: string) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  setPaymentMethod: (m: PaymentMethod | null) => void
  openReturnModal: () => void
}

export function POSCart({
  cart,
  cartTotal,
  cartItemCount,
  incrementQty,
  decrementQty,
  removeFromCart,
  clearCart,
  setPaymentMethod,
  openReturnModal
}: POSCartProps) {
  return (
    <div className="w-full space-y-4 flex flex-col h-full relative z-10">
      <div className="flex-[1_1_auto] bg-white/90 dark:bg-white/[0.02] backdrop-blur-2xl rounded-3xl border border-surface/50 dark:border-white/[0.06] overflow-hidden shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col min-h-[600px] transition-all duration-500">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface/40 dark:border-white/[0.06] bg-surface-light/40 dark:bg-black/20">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
              <div className="absolute inset-0 bg-brand animate-pulse blur-md opacity-20 rounded-full" />
              <ShoppingCart className="w-5 h-5 text-brand relative z-10" />
            </div>
            <h2 className="font-bold text-xl text-foreground drop-shadow-sm">Carrello</h2>
            {cartItemCount > 0 && (
              <span className="bg-brand text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm ml-2">
                {cartItemCount} pz
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-danger/80 hover:text-danger hover:bg-danger/10 transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-danger/20"
            >
              Svuota tutto
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto w-full">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-foreground/30 gap-4 opacity-70">
              <ShoppingCart className="w-16 h-16" />
              <p className="text-lg font-medium">Carrello vuoto</p>
            </div>
          ) : (
            <div className="divide-y border-surface/40 dark:divide-white/[0.06]">
              {cart.map((item) => (
                <div key={item.inventoryId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-surface-light/40 dark:hover:bg-white/[0.02] transition-colors group">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <p className="font-bold text-[15px] text-foreground truncate">{item.name}</p>
                    <div className="text-[12px] text-foreground/60 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Brand: <strong className="text-foreground/80">{item.brand || 'N/D'}</strong></span>
                      <span>Taglia: <strong className="text-foreground/80">{item.size || '-'}</strong></span>
                      <span>Colore: <strong className="text-foreground/80">{item.color || '-'}</strong></span>
                      {item.material && <span>Materiale: <strong className="text-foreground/80">{item.material}</strong></span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 sm:shrink-0 justify-between sm:justify-end w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 bg-surface-light/80 dark:bg-black/30 rounded-xl p-1 border border-surface/50 dark:border-white/[0.06]">
                      <button onClick={() => decrementQty(item.inventoryId)} className="w-8 h-8 rounded-lg hover:bg-surface-light dark:hover:bg-white/10 flex items-center justify-center transition-colors"><Minus className="w-4 h-4 text-foreground/60" /></button>
                      <span className="w-8 text-center font-bold text-[15px]">{item.qty}</span>
                      <button disabled={item.qty >= item.maxQty} onClick={() => incrementQty(item.inventoryId)} className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-colors', item.qty >= item.maxQty ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-light dark:hover:bg-white/10')}><Plus className="w-4 h-4 text-foreground/60" /></button>
                    </div>
                    
                    <div className="text-right w-[80px]">
                      <p className="font-bold text-[16px] text-brand">{formatCurrency(item.price * item.qty)}</p>
                    </div>
                    
                    <button onClick={() => removeFromCart(item.inventoryId)} className="relative w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm hover:shadow-red-500/40">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface/50 dark:border-white/[0.06] bg-gradient-to-b from-surface-light/40 to-surface-light/60 dark:from-black/30 dark:to-black/50 p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-widest text-foreground/60">Totale Cassa</span>
            <span className="text-4xl font-black text-foreground drop-shadow-md bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{formatCurrency(cartTotal)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => cart.length > 0 && setPaymentMethod('cash')}
              disabled={cart.length === 0}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-2xl py-6 shadow-xl transition-all duration-500 relative overflow-hidden group',
                cart.length === 0 
                  ? 'bg-surface-light/50 text-foreground/30 cursor-not-allowed border border-surface/40 dark:border-white/[0.06]' 
                  : 'bg-gradient-to-br from-[#7BB35F] to-[#6CAE4A] text-white hover:scale-[1.02] active:scale-95 border border-[#8CE36B]/30 shadow-[0_10px_40px_rgba(123,179,95,0.4)]'
              )}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 blur-2xl opacity-30" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-white blur-md opacity-0 group-hover:opacity-40 rounded-full transition-opacity" />
                  <Banknote className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <span className="font-bold tracking-wider text-[13px] uppercase drop-shadow-sm">Chiudi Cassa<br/>(Contanti)</span>
              </div>
            </button>
            <button
              onClick={() => cart.length > 0 && setPaymentMethod('pos')}
              disabled={cart.length === 0}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-2xl py-6 shadow-xl transition-all duration-500 relative overflow-hidden group',
                cart.length === 0 
                  ? 'bg-surface-light/50 text-foreground/30 cursor-not-allowed border border-surface/40 dark:border-white/[0.06]' 
                  : 'bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:scale-[1.02] active:scale-95 border border-blue-400/30 shadow-[0_10px_40px_rgba(37,99,235,0.4)]'
              )}
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 blur-2xl opacity-30" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-white blur-md opacity-0 group-hover:opacity-40 rounded-full transition-opacity" />
                  <CreditCard className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <span className="font-bold tracking-wider text-[13px] uppercase drop-shadow-sm">Chiudi Cassa<br/>(POS / Carta)</span>
              </div>
            </button>
          </div>
          
          <button
            onClick={openReturnModal}
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 bg-transparent border-2 border-amber-500/40 text-amber-600 dark:text-amber-500 hover:bg-amber-500 hover:text-white transition-all duration-300 font-bold tracking-wider text-[13px] uppercase shadow-sm group"
          >
            <RotateCcw className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" strokeWidth={2.5} />
            Effettua Reso Articolo
          </button>
        </div>
      </div>
    </div>
  )
}
