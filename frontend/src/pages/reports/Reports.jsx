/**
 * GARUDA — Reports & Intelligence Module (Page 8)
 * Route: /reports
 * Generate operational reports, analytical summaries, and DPR-format documents.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconChart, IconClipboard, IconLock, IconTool, IconScale, IconReports,
  IconWarning, IconRunning, IconBell, IconOffender, IconPackage,
} from '../../components/Icons';

const TABS = [
  { id: 'standard', label: 'Standard Reports', Icon: IconChart },
  { id: 'dpr', label: 'DPR Export', Icon: IconClipboard },
  { id: 'intel', label: 'Intelligence Summary', Icon: IconLock },
  { id: 'custom', label: 'Custom Builder', Icon: IconTool },
  { id: 'court', label: 'Court Diary', Icon: IconScale },
  { id: 'performance', label: 'Performance', Icon: IconReports },
];

const STANDARD_REPORTS = [
  { name: 'Monthly Case Abstract', desc: 'Station-wise case summary for current month', Icon: IconClipboard, color: '#3b82f6' },
  { name: 'Yearly Comparative Chart', desc: 'Cases, arrests, convictions year-over-year', Icon: IconChart, color: '#8b5cf6' },
  { name: 'Pending Charge Sheet', desc: 'Cases beyond 60/180 days without CS', Icon: IconWarning, color: '#f59e0b' },
  { name: 'Absconder List', desc: 'Pending arrests with days outstanding', Icon: IconRunning, color: '#ef4444' },
  { name: 'Bail Expiry Alert', desc: 'Upcoming bail expiration dates', Icon: IconBell, color: '#d97706' },
  { name: 'Court Pending List', desc: 'Pending cases with next hearing dates', Icon: IconScale, color: '#6366f1' },
  { name: 'Drug Seizure Summary', desc: 'Drug-type-wise seizure quantities', Icon: IconPackage, color: '#059669' },
  { name: 'Top 10 Repeat Offenders', desc: 'Most frequent accused persons', Icon: IconOffender, color: '#b45309' },
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
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : undefined} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Standard Reports Grid */}
      {activeTab === 'standard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STANDARD_REPORTS.map(report => (
            <div
              key={report.name}
              className="card card-hover rounded-xl p-5 cursor-pointer"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{ background: report.color + '14' }}
              >
                <report.Icon size={20} color={report.color} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{report.name}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{report.desc}</p>
              <button className="btn btn-secondary btn-sm mt-3">
                Generate
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Other tabs - Coming Soon */}
      {activeTab !== 'standard' && (
        <div className="card rounded-xl p-8 text-center">
          <div className="space-y-4">
            {(() => {
              const tab = TABS.find(t => t.id === activeTab);
              return tab ? (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: 'var(--color-garuda-600)' }}>
                  <tab.Icon size={28} color="var(--color-garuda-400)" />
                </div>
              ) : null;
            })()}
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
            <span className="btn btn-sm" style={{ background: '#0ea5e9', color: '#fff', borderColor: '#0ea5e9', cursor: 'default' }}>
              Coming in Phase 2 — Operations
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
