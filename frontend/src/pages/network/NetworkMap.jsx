/**
 * GARUDA — Network & Chain of Command Analysis (Page 7)
 * Route: /network
 * Visualise and map the full drug supply chain with accused linkage graphs.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const TABS = [
  { id: 'chain', label: 'Chain Builder', icon: '🕸️' },
  { id: 'interstate', label: 'Interstate Links', icon: '🗺️' },
  { id: 'clusters', label: 'Network Clusters', icon: '🔗' },
  { id: 'kingpin', label: 'Kingpin Profiling', icon: '👑' },
  { id: 'consignment', label: 'Consignment Trail', icon: '📦' },
  { id: 'linkage', label: 'Case Linkage', icon: '⛓️' },
];

const NODE_TYPES = [
  { type: 'Supplier', icon: '🔴', desc: 'Interstate source' },
  { type: 'Transporter', icon: '🟠', desc: 'Carries contraband' },
  { type: 'Peddler', icon: '🟡', desc: 'Street-level distribution' },
  { type: 'Consumer', icon: '🟢', desc: 'End user' },
  { type: 'Financier', icon: '🔵', desc: 'Funds the network' },
  { type: 'Unknown', icon: '⚪', desc: 'Not yet identified' },
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
          <div key={n.type} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}>
            <span>{n.icon}</span>
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
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', minHeight: '300px' }}>
        <div className="space-y-4">
          <div className="text-4xl">{TABS.find(t => t.id === activeTab)?.icon}</div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: '#e11d48', color: '#fff' }}>
            Coming in Phase 3 — Intelligence
          </div>
        </div>
      </div>
    </div>
  );
}
