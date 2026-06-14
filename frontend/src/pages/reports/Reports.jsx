/**
 * GARUDA — Reports & Intelligence Module (Page 8)
 * Route: /reports
 * Generate operational reports, analytical summaries, and DPR-format documents.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../api/axios';
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
  { name: 'Monthly Case Abstract', desc: 'Station-wise case summary for current month', Icon: IconClipboard, color: '#3b82f6', key: 'monthly' },
  { name: 'Yearly Comparative Chart', desc: 'Cases, arrests, convictions year-over-year', Icon: IconChart, color: '#8b5cf6', key: 'yearly' },
  { name: 'Pending Charge Sheet', desc: 'Cases beyond 60/180 days without CS', Icon: IconWarning, color: '#f59e0b', key: 'pending_cs' },
  { name: 'Absconder List', desc: 'Pending arrests with days outstanding', Icon: IconRunning, color: '#ef4444', key: 'absconder' },
  { name: 'Bail Expiry Alert', desc: 'Upcoming bail expiration dates', Icon: IconBell, color: '#d97706', key: 'bail_expiry' },
  { name: 'Court Pending List', desc: 'Pending cases with next hearing dates', Icon: IconScale, color: '#6366f1', key: 'court_pending' },
  { name: 'Drug Seizure Summary', desc: 'Drug-type-wise seizure quantities', Icon: IconPackage, color: '#059669', key: 'seizure' },
  { name: 'Top 10 Repeat Offenders', desc: 'Most frequent accused persons', Icon: IconOffender, color: '#b45309', key: 'top_offenders' },
];

const SEVERITY_STYLES = {
  CRITICAL: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  HIGH:     { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  MEDIUM:   { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', border: 'rgba(234,179,8,0.3)' },
  LOW:      { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('standard');
  const perms = usePermissions();

  // Report results state
  const [activeReport, setActiveReport] = useState(null); // which report is shown
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const generateReport = async (reportKey) => {
    if (reportKey !== 'absconder') {
      // Other reports not yet implemented — show a gentle message
      setActiveReport(reportKey);
      setReportData(null);
      setReportError('This report type is coming in Phase 2.');
      return;
    }

    setActiveReport(reportKey);
    setReportLoading(true);
    setReportError('');
    setReportData(null);

    try {
      const res = await api.get('/reports/absconder-list');
      setReportData(res.data.data);
    } catch (err) {
      setReportError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/absconder-list?format=csv', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `absconder-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setReportError('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const closeReport = () => {
    setActiveReport(null);
    setReportData(null);
    setReportError('');
  };

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
            onClick={() => { setActiveTab(tab.id); closeReport(); }}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : undefined} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Standard Reports Grid */}
      {activeTab === 'standard' && (
        <>
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
                <button
                  className="btn btn-secondary btn-sm mt-3"
                  onClick={() => generateReport(report.key)}
                  disabled={reportLoading && activeReport === report.key}
                  style={{
                    opacity: reportLoading && activeReport === report.key ? 0.6 : 1,
                    cursor: reportLoading && activeReport === report.key ? 'wait' : 'pointer',
                  }}
                >
                  {reportLoading && activeReport === report.key ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                      Generating...
                    </span>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* ── Report Results Panel ───────────────────────────────────── */}
          {activeReport && (
            <div className="card rounded-xl overflow-hidden animate-fade-in">
              {/* Header */}
              <div
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderBottom: '1px solid var(--color-garuda-700)' }}
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const r = STANDARD_REPORTS.find(r => r.key === activeReport);
                    return r ? (
                      <>
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: r.color + '14' }}
                        >
                          <r.Icon size={16} color={r.color} />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
                            {r.name}
                          </h2>
                          {reportData && (
                            <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-garuda-500)' }}>
                              Generated: {new Date(reportData.generatedAt).toLocaleString('en-IN')} • {reportData.totalAbsconders} records
                            </p>
                          )}
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {activeReport === 'absconder' && reportData && (
                    <button
                      className="btn btn-sm"
                      onClick={exportCsv}
                      disabled={exporting}
                      style={{
                        background: '#059669',
                        color: '#fff',
                        borderColor: '#059669',
                        opacity: exporting ? 0.6 : 1,
                      }}
                    >
                      {exporting ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                          Exporting...
                        </span>
                      ) : (
                        '⬇ Export CSV'
                      )}
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={closeReport}
                    style={{ cursor: 'pointer' }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {reportLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <span className="w-8 h-8 rounded-full border-3 border-[var(--color-accent-400)] border-t-transparent animate-spin inline-block" />
                      <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Generating report...</p>
                    </div>
                  </div>
                )}

                {reportError && !reportLoading && (
                  <div
                    className="p-4 rounded-lg text-center"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    <p className="text-sm" style={{ color: '#ef4444' }}>{reportError}</p>
                  </div>
                )}

                {/* Absconder Report Table */}
                {activeReport === 'absconder' && reportData && !reportLoading && (
                  <>
                    {/* Summary Chips */}
                    <div className="flex flex-wrap gap-3 mb-5">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
                        const count = reportData.absconders.filter(a => a.severity === sev).length;
                        if (count === 0) return null;
                        const s = SEVERITY_STYLES[sev];
                        return (
                          <div
                            key={sev}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                            {sev}: {count}
                            <span className="font-normal opacity-75">
                              ({sev === 'CRITICAL' ? '>90 days' : sev === 'HIGH' ? '>60 days' : sev === 'MEDIUM' ? '>30 days' : '≤30 days'})
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {reportData.absconders.length === 0 ? (
                      <div className="text-center py-12">
                        <IconRunning size={32} color="var(--color-garuda-500)" />
                        <p className="text-sm mt-3" style={{ color: 'var(--color-garuda-400)' }}>No absconders found</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--color-garuda-700)' }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: 'var(--color-garuda-900)' }}>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>#</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Offender</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Age</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Father/Husband</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>FIR No</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>PS</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Case Date</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Section</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Days</th>
                              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Severity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.absconders.map((a, i) => {
                              const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.LOW;
                              return (
                                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-500)' }}>{i + 1}</td>
                                  <td className="px-3 py-2.5">
                                    <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{a.offenderName}</p>
                                    {a.alias && <p className="text-[10px]" style={{ color: 'var(--color-garuda-500)' }}>alias: {a.alias}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-300)' }}>{a.age || '—'}</td>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-300)' }}>{a.fatherName || '—'}</td>
                                  <td className="px-3 py-2.5 text-xs font-mono font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{a.firNo}</td>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-300)' }}>{a.psName}</td>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-300)' }}>
                                    {a.caseDate ? new Date(a.caseDate).toLocaleDateString('en-IN') : '—'}
                                  </td>
                                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-garuda-300)' }}>{a.sectionOfLaw || '—'}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="text-sm font-bold" style={{ color: sev.color }}>{a.daysOutstanding}d</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span
                                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                      style={{
                                        background: sev.bg,
                                        color: sev.color,
                                        border: `1px solid ${sev.border}`,
                                      }}
                                    >
                                      {a.severity}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
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
