import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Loader2, CheckCircle, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

export function CheckoutForm() {
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: string; note?: string; orderId?: string } | null>(null);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003';
      const response = await axios.post(`${apiUrl}/checkout`, {
        userId: 'user_123',
        amount: Number(amount),
        currency: 'USD',
      });
      setResult(response.data);
    } catch (error: any) {
      setResult({ status: 'failed', note: error.response?.data?.message || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-700"></div>
      
      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <ShieldCheck className="text-indigo-400" /> Secure Checkout
      </h2>
      
      <form onSubmit={handleCheckout} className="space-y-6 relative z-10">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Amount (USD)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
              min="1"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-medium py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Pay Now'}
        </button>
      </form>

      {result && (
        <div className="mt-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {result.status === 'confirmed' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-emerald-400">Payment Confirmed</h4>
                <p className="text-sm text-emerald-400/80 mt-1">Order ID: {result.orderId}</p>
              </div>
            </div>
          )}

          {result.status === 'degraded' && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-amber-400 flex items-center gap-2">
                  Payment Confirmed <span className="text-[10px] uppercase bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">Degraded</span>
                </h4>
                <p className="text-sm text-amber-400/80 mt-1">Note: {result.note}</p>
                <p className="text-xs text-amber-400/60 mt-1">Order ID: {result.orderId}</p>
              </div>
            </div>
          )}

          {result.status === 'queued' && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
              <Clock className="text-blue-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-blue-400 flex items-center gap-2">
                  Payment Queued <span className="text-[10px] uppercase bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">Pending</span>
                </h4>
                <p className="text-sm text-blue-400/80 mt-1">{result.note}. We will notify you when it completes.</p>
                <p className="text-xs text-blue-400/60 mt-1">Order ID: {result.orderId}</p>
              </div>
            </div>
          )}

          {result.status === 'failed' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-medium text-red-400">Payment Failed</h4>
                <p className="text-sm text-red-400/80 mt-1">{result.note}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
