/**
 * GARUDA — Network & Chain of Command Analysis (Page 7)
 * Route: /network
 * Visualise and map the full drug supply chain with accused linkage graphs.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconNetwork, IconMap, IconChain, IconShield, IconPackage, IconCases,
} from '../../components/Icons';

const TABS = [
  { id: 'chain', label: 'Chain Builder', Icon: IconNetwork, color: '#6366f1' },
  { id: 'interstate', label: 'Interstate Links', Icon: IconMap, color: '#0891b2' },
  { id: 'clusters', label: 'Network Clusters', Icon: IconChain, color: '#059669' },
  { id: 'kingpin', label: 'Kingpin Profiling', Icon: IconShield, color: '#dc2626' },
  { id: 'consignment', label: 'Consignment Trail', Icon: IconPackage, color: '#f59e0b' },
  { id: 'linkage', label: 'Case Linkage', Icon: IconCases, color: '#8b5cf6' },
];

const NODE_TYPES = [
  { type: 'Supplier', color: '#ef4444', desc: 'Interstate source' },
  { type: 'Transporter', color: '#f97316', desc: 'Carries contraband' },
  { type: 'Peddler', color: '#eab308', desc: 'Street-level distribution' },
  { type: 'Consumer', color: '#22c55e', desc: 'End user' },
  { type: 'Financier', color: '#3b82f6', desc: 'Funds the network' },
  { type: 'Unknown', color: '#94a3b8', desc: 'Not yet identified' },
];

export default function NetworkMap() {
  const [activeTab, setActiveTab] = useState('chain');
  const perms = usePermissions();

  const descriptions = {
    chain: {
      title: 'Chain of Command Builder',
      desc: 'Interactive node-link graph with drag-and-drop placement. Each node links to accused profiles. Draw edges to represent supply chain relationships.',
    },
    interstate: {
      title: 'Interstate Link Mapping',
      desc: 'Map contraband routes from source states (Odisha, Karnataka, Tamil Nadu) to Tirupati District with transit annotations and arrest data.',
    },
    clusters: {
      title: 'Network Cluster View',
      desc: 'Auto-generated clusters from shared mobile numbers, source locations, destinations, and named associates across cases.',
    },
    kingpin: {
      title: 'Kingpin / Key Suspect Profiling',
      desc: 'Mark suspects as Kingpin. Generate full dossier with case history, associates, financial links, technical intel, and surveillance sightings.',
    },
    consignment: {
      title: 'Consignment Trail',
      desc: 'Per case: source → transit route → seizure point → destination. Quantity comparisons and estimated loss per seizure.',
    },
    linkage: {
      title: 'Case Linkage',
      desc: 'Link related cases involving the same network. Shared accused are highlighted — useful for Section 29 NDPS conspiracy charges.',
    },
  };

  const current = descriptions[activeTab];
  const activeTabObj = TABS.find(t => t.id === activeTab);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          Network & Chain Analysis
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Drug supply chain mapping — supplier to consumer with accused linkage
        </p>
      </div>

      {/* Node Type Legend */}
      <div className="flex gap-3 flex-wrap">
        {NODE_TYPES.map(n => (
          <div key={n.type} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: n.color }} />
            <span>{n.type}</span>
          </div>
        ))}
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
      <div className="card rounded-xl p-8 text-center" style={{ minHeight: '300px' }}>
        <div className="space-y-4">
          {activeTabObj && (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: activeTabObj.color + '14' }}>
              <activeTabObj.Icon size={28} color={activeTabObj.color} />
            </div>
          )}
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <span className="btn btn-sm" style={{ background: '#e11d48', color: '#fff', borderColor: '#e11d48', cursor: 'default' }}>
            Coming in Phase 3 — Intelligence
          </span>
        </div>
      </div>
    </div>
  );
}
