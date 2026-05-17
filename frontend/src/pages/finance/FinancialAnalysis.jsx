/**
 * GARUDA — Financial Analysis Module (Page 6)
 * Route: /finance
 * Track money flow in NDPS networks — financiers, suspicious transactions, UPI/hawala trails.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const TABS = [
  { id: 'profile', label: 'Financial Profiles', icon: '💳' },
  { id: 'transactions', label: 'Transaction Log', icon: '💸' },
  { id: 'financiers', label: 'Financier ID', icon: '🏦' },
  { id: 'flow', label: 'Money Flow Map', icon: '🔄' },
  { id: 'upi', label: 'UPI / Wallet', icon: '📲' },
  { id: 'assets', label: 'Asset Seizures', icon: '🏠' },
];

export default function FinancialAnalysis() {
  const [activeTab, setActiveTab] = useState('profile');
  const perms = usePermissions();

  const descriptions = {
    profile: {
      title: 'Suspect Financial Profile',
      desc: 'Link accused to bank accounts, UPI IDs, suspicious transaction notes, hawala connections, and income-lifestyle discrepancy analysis.',
    },
    transactions: {
      title: 'Transaction Log',
      desc: 'Manual entry of suspicious transactions — date, amount, mode (Cash/UPI/Bank/Hawala/Crypto), parties, and investigation status.',
    },
    financiers: {
      title: 'Financier Identification',
      desc: 'Flag suspects as financiers. Map network connections, cases funded, estimated capital, and ED referral status.',
    },
    flow: {
      title: 'Money Flow Map',
      desc: 'Visual flow diagram: Financier → Supplier → Transporter → Peddler → Consumer. Nodes link to accused profiles with transaction amounts.',
    },
    upi: {
      title: 'UPI / Wallet Analysis',
      desc: 'Log UPI transactions, link IDs to accused profiles, and identify patterns in frequency, amounts, and timing.',
    },
    assets: {
      title: 'Asset Seizure Register',
      desc: 'Vehicles, cash, property, bank account freeze orders, and MOB status tracking from NDPS cases.',
    },
  };

  const current = descriptions[activeTab];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          Financial Analysis
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Money flow tracking — financiers, transactions, UPI/hawala trails
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'var(--color-accent-500)' : 'var(--color-garuda-800)',
              color: activeTab === tab.id ? '#fff' : 'var(--color-garuda-300)',
              border: `1px solid ${activeTab === tab.id ? 'var(--color-accent-500)' : 'var(--color-garuda-700)'}`,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <div className="space-y-4">
          <div className="text-4xl">{TABS.find(t => t.id === activeTab)?.icon}</div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: '#a855f7', color: '#fff' }}>
            Coming in Phase 3 — Intelligence
          </div>
        </div>
      </div>
    </div>
  );
}
