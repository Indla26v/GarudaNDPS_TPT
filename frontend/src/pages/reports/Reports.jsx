/**
 * GARUDA — Reports & Intelligence Module (Page 8)
 * Route: /reports
 * Generate operational reports, analytical summaries, and DPR-format documents.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const TABS = [
  { id: 'standard', label: 'Standard Reports', icon: '📊' },
  { id: 'dpr', label: 'DPR Export', icon: '📋' },
  { id: 'intel', label: 'Intelligence Summary', icon: '🔒' },
  { id: 'custom', label: 'Custom Builder', icon: '🛠️' },
  { id: 'court', label: 'Court Diary', icon: '⚖️' },
  { id: 'performance', label: 'Performance', icon: '📈' },
];

const STANDARD_REPORTS = [
  { name: 'Monthly Case Abstract', desc: 'Station-wise case summary for current month', icon: '📅' },
  { name: 'Yearly Comparative Chart', desc: 'Cases, arrests, convictions year-over-year', icon: '📈' },
  { name: 'Pending Charge Sheet', desc: 'Cases beyond 60/180 days without CS', icon: '⚠️' },
  { name: 'Absconder List', desc: 'Pending arrests with days outstanding', icon: '🏃' },
  { name: 'Bail Expiry Alert', desc: 'Upcoming bail expiration dates', icon: '🔔' },
  { name: 'Court Pending List', desc: 'Pending cases with next hearing dates', icon: '⚖️' },
  { name: 'Drug Seizure Summary', desc: 'Drug-type-wise seizure quantities', icon: '💊' },
  { name: 'Top 10 Repeat Offenders', desc: 'Most frequent accused persons', icon: '👤' },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('standard');
  const perms = usePermissions();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          Reports & Intelligence
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Operational reports, DPR exports, intelligence summaries, and court diary
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

      {/* Standard Reports Grid */}
      {activeTab === 'standard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STANDARD_REPORTS.map(report => (
            <div
              key={report.name}
              className="rounded-xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
              style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
            >
              <div className="text-2xl mb-3">{report.icon}</div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{report.name}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{report.desc}</p>
              <button
                className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
              >
                Generate
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Other tabs - Coming Soon */}
      {activeTab !== 'standard' && (
        <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="space-y-4">
            <div className="text-4xl">{TABS.find(t => t.id === activeTab)?.icon}</div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
              {activeTab === 'dpr' && 'DPR format export matching existing spreadsheet — Excel and PDF output with separate Police and Excise station reports.'}
              {activeTab === 'intel' && 'Analyst-prepared narrative intelligence reports with classified markings, addressee selection, and digital signature support.'}
              {activeTab === 'custom' && 'Select fields, date range, stations, drug types, accused roles, and case status to build custom tabular reports. Export as Excel, PDF, or CSV.'}
              {activeTab === 'court' && 'All upcoming court hearings in next 7/30 days with responsible officers, required documents, and reminder notifications.'}
              {activeTab === 'performance' && 'Cases vs. target, charge sheet submission rate, conviction rate, station-wise and officer-wise comparisons.'}
            </p>
            <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: '#0ea5e9', color: '#fff' }}>
              Coming in Phase 2 — Operations
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
