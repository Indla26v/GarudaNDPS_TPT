/**
 * GARUDA — Financial Analysis Module (Page 6)
 * Route: /finance
 * Track money flow in NDPS networks — financiers, suspicious transactions, UPI/hawala trails.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconFinance, IconDollar, IconBuilding, IconNetwork, IconFieldStaff, IconPackage,
} from '../../components/Icons';

const TABS = [
  { id: 'profile', label: 'Financial Profiles', Icon: IconFinance, color: '#3b82f6' },
  { id: 'transactions', label: 'Transaction Log', Icon: IconDollar, color: '#22c55e' },
  { id: 'financiers', label: 'Financier ID', Icon: IconBuilding, color: '#8b5cf6' },
  { id: 'flow', label: 'Money Flow Map', Icon: IconNetwork, color: '#ec4899' },
  { id: 'upi', label: 'UPI / Wallet', Icon: IconFieldStaff, color: '#0ea5e9' },
  { id: 'assets', label: 'Asset Seizures', Icon: IconPackage, color: '#f59e0b' },
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
  const activeTabObj = TABS.find(t => t.id === activeTab);

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
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : undefined} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card rounded-xl p-8 text-center">
        <div className="space-y-4">
          {activeTabObj && (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: activeTabObj.color + '14' }}>
              <activeTabObj.Icon size={28} color={activeTabObj.color} />
            </div>
          )}
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <span className="btn btn-sm" style={{ background: '#a855f7', color: '#fff', borderColor: '#a855f7', cursor: 'default' }}>
            Coming in Phase 3 — Intelligence
          </span>
        </div>
      </div>
    </div>
  );
}
