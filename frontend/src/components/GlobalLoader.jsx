import { useState, useEffect } from 'react';
import { subscribeToLoading } from '../api/axios';

export default function GlobalLoader() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeToLoading(setLoading);
  }, []);

  useEffect(() => {
    if (loading) {
      document.body.classList.add('global-loading');
    } else {
      document.body.classList.remove('global-loading');
    }
    return () => {
      document.body.classList.remove('global-loading');
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="absolute inset-0 z-[45] flex flex-col items-center justify-center backdrop-blur-sm bg-slate-900/40 dark:bg-slate-950/50 transition-all duration-300 pointer-events-auto">
      <div className="relative flex flex-col items-center">
        {/* Concentric scanning circles */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-accent-500/30 animate-[spin_8s_linear_infinite]" />
          {/* Middle ring */}
          <div className="absolute inset-2 rounded-full border-4 border-double border-indigo-500/50 animate-[spin_4s_linear_infinite_reverse]" />
          {/* Inner ring with pulse */}
          <div className="absolute inset-4 rounded-full border border-accent-400 bg-accent-500/10 animate-ping" />
          {/* Center Core with pulsing shield icon */}
          <div className="absolute inset-6 rounded-full bg-linear-to-tr from-accent-500 to-indigo-600 shadow-lg flex items-center justify-center text-white">
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
        </div>
        
        {/* Buffering text */}
        <h3 className="mt-6 text-sm font-bold tracking-wider text-slate-800 dark:text-slate-200 uppercase animate-pulse">
          Syncing Garuda Intelligence
        </h3>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          Aggregating real-time database inputs...
        </p>
        
        {/* Scan line indicator */}
        <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-4 overflow-hidden relative">
          <div className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-accent-400 to-transparent animate-[loading-bar_1.5s_infinite_linear]" />
        </div>
      </div>
    </div>
  );
}
