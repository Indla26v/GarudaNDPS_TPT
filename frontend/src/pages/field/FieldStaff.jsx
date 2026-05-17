/**
 * GARUDA — Field Staff Module (Page 4)
 * Route: /mobile
 * Real-time field data entry, accused verification, surveillance reporting.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const TABS = [
  { id: 'quick-entry', label: 'Quick Case Entry', icon: '📝', perm: 'FIELD_ENTRY' },
  { id: 'verify', label: 'Accused Verification', icon: '🔍', perm: 'ACCUSED_VERIFY' },
  { id: 'surveillance', label: 'Surveillance Report', icon: '📡', perm: 'SURVEILLANCE_REPORT' },
  { id: 'informer', label: 'Informer Mgmt', icon: '🤫', perm: null },
  { id: 'checkpoint', label: 'Checkpoint Log', icon: '🚧', perm: 'FIELD_ENTRY' },
];

export default function FieldStaff() {
  const [activeTab, setActiveTab] = useState('quick-entry');
  const perms = usePermissions();

  const visibleTabs = TABS.filter(t => {
    if (t.id === 'informer') return perms.canManageInformers || perms.canReadInformers;
    if (t.perm) return perms.hasPermission(t.perm);
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          Field Staff Module
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Mobile-optimised field operations — data entry, verification, surveillance
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        {visibleTabs.map(tab => (
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

      {/* Tab Content */}
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        {activeTab === 'quick-entry' && (
          <div className="space-y-4">
            <div className="text-4xl">📝</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Quick Case Entry</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              Mobile-optimised form with GPS auto-fill, photo capture, and voice-to-text for field intelligence notes.
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Coming in Phase 2
            </div>
          </div>
        )}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            <div className="text-4xl">🔍</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Accused Verification</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              Search by name, mobile, or Aadhaar. Returns photo, case history, active warrants, and bail status.
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Coming in Phase 2
            </div>
          </div>
        )}
        {activeTab === 'surveillance' && (
          <div className="space-y-4">
            <div className="text-4xl">📡</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>GPS-Tagged Surveillance</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              Structured surveillance log with GPS auto-tagging, photo attachments, and informer reference codes.
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Coming in Phase 2
            </div>
          </div>
        )}
        {activeTab === 'informer' && (
          <div className="space-y-4">
            <div className="text-4xl">🤫</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Informer Management</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              Register informers with code names, log intelligence received, and track rewards. Restricted to CI, SI, SP, DSP.
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Coming in Phase 2
            </div>
          </div>
        )}
        {activeTab === 'checkpoint' && (
          <div className="space-y-4">
            <div className="text-4xl">🚧</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Checkpoint / Nakabandhi Log</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              Record vehicle checks at checkpoints, log suspicious details, and flag for follow-up.
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Coming in Phase 2
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
