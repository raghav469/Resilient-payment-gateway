import { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, ZapOff, Snail, Zap, Activity } from 'lucide-react';

export function AdminPanel() {
  const [circuitState, setCircuitState] = useState<{ state: string; failureCount: number } | null>(null);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003';
        const response = await axios.get(`${apiUrl}/admin/circuit-state`);
        setCircuitState(response.data);
      } catch (error) {
        // fail silently for polling
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, []);

  const triggerProvider = async (action: 'fail' | 'slow' | 'recover') => {
    try {
      const mockUrl = import.meta.env.VITE_MOCK_PROVIDER_URL || 'http://localhost:3002';
      await axios.post(`${mockUrl}/admin/${action}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden group h-full">
      <div className="absolute bottom-0 right-0 p-32 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700"></div>

      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
        <Settings className="text-purple-400" /> Admin Controls
      </h2>

      <div className="space-y-8 relative z-10">
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Mock Provider State</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => triggerProvider('fail')}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl py-3 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <ZapOff size={20} />
              <span className="text-xs font-medium">Fail (500)</span>
            </button>
            <button
              onClick={() => triggerProvider('slow')}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl py-3 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <Snail size={20} />
              <span className="text-xs font-medium">Slow (5-8s)</span>
            </button>
            <button
              onClick={() => triggerProvider('recover')}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl py-3 flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <Zap size={20} />
              <span className="text-xs font-medium">Recover (200)</span>
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider flex items-center justify-between">
            <span>Circuit Breaker</span>
            <Activity size={14} className="text-indigo-400 animate-pulse" />
          </h3>
          <div className="bg-black/40 border border-white/5 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Current State</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  circuitState?.state === 'closed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                  circuitState?.state === 'open' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                  circuitState?.state === 'half-open' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                  'bg-gray-500'
                }`}></div>
                <span className="font-semibold text-lg uppercase tracking-wide">
                  {circuitState?.state || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Failures</p>
              <span className="font-mono text-xl">{circuitState?.failureCount || 0}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-gray-500 leading-relaxed">
            Use this panel to simulate a flaky third-party API. Watch the circuit breaker trip open after 5 consecutive failures, 
            triggering graceful degradation (cached responses), and eventually routing to the Dead Letter Queue.
          </p>
        </div>
      </div>
    </div>
  );
}
