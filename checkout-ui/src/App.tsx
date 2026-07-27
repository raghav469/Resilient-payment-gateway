
import { CheckoutForm } from './components/CheckoutForm';
import { AdminPanel } from './components/AdminPanel';
import { CreditCard } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white font-sans selection:bg-indigo-500/30">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <CreditCard size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Resilient<span className="text-indigo-400 font-light">Pay</span></h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 flex flex-col lg:flex-row gap-8 items-start">
        <div className="w-full lg:w-1/2 flex flex-col gap-8">
          <CheckoutForm />
        </div>
        
        <div className="w-full lg:w-1/2">
          <AdminPanel />
        </div>
      </main>
    </div>
  );
}

export default App;
