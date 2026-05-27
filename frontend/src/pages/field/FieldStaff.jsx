/**
 * GARUDA — Field Staff Module (Page 4)
 * Route: /mobile
 * Real-time field data entry, accused verification, surveillance reporting.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconEdit, IconSearch, IconSurveillance, IconLock, IconShield,
} from '../../components/Icons';

const TABS = [
  { id: 'quick-entry', label: 'Quick Case Entry', Icon: IconEdit, color: '#3b82f6', perm: 'FIELD_ENTRY' },
  { id: 'verify', label: 'Accused Verification', Icon: IconSearch, color: '#059669', perm: 'FIELD_VERIFY' },
  { id: 'surveillance', label: 'Surveillance Report', Icon: IconSurveillance, color: '#7c3aed', perm: 'FIELD_ENTRY' },
  { id: 'informer', label: 'Informer Mgmt', Icon: IconLock, color: '#d97706', perm: null },
  { id: 'checkpoint', label: 'Checkpoint Log', Icon: IconShield, color: '#ef4444', perm: 'FIELD_ENTRY' },
];

export default function FieldStaff() {
  const [activeTab, setActiveTab] = useState('quick-entry');
  const perms = usePermissions();

  const visibleTabs = TABS.filter(t => {
    if (t.id === 'informer') return perms.hasMinRole('SI') && perms.inDepartment('OPERATIONS', 'STF', 'INTELLIGENCE');
    if (t.perm) return perms.hasPermission(t.perm);
    return true;
  });

  const activeTabObj = TABS.find(t => t.id === activeTab);

  const descriptions = {
    'quick-entry': { title: 'Quick Case Entry', desc: 'Mobile-optimised form with GPS auto-fill, photo capture, and voice-to-text for field intelligence notes.' },
    'verify': { title: 'Accused Verification', desc: 'Search by name, mobile, or Aadhaar. Returns photo, case history, active warrants, and bail status.' },
    'surveillance': { title: 'GPS-Tagged Surveillance', desc: 'Structured surveillance log with GPS auto-tagging, photo attachments, and informer reference codes.' },
    'informer': { title: 'Informer Management', desc: 'Register informers with code names, log intelligence received, and track rewards. Restricted to CI, SI, SP, DSP.' },
    'checkpoint': { title: 'Checkpoint / Nakabandhi Log', desc: 'Record vehicle checks at checkpoints, log suspicious details, and flag for follow-up.' },
  };

  const current = descriptions[activeTab];

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
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : undefined} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card rounded-xl p-8 text-center">
        <div className="space-y-4">
          {activeTabObj && (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: activeTabObj.color + '14' }}>
              <activeTabObj.Icon size={28} color={activeTabObj.color} />
            </div>
          )}
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <span className="btn btn-sm btn-primary" style={{ cursor: 'default' }}>
            Coming in Phase 2
          </span>
        </div>
      </div>
    </div>
  );
}
