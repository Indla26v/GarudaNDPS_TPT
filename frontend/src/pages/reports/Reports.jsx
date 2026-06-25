/**
 * GARUDA — Reports & Intelligence Module (Page 8)
 * Route: /reports
 * Generate operational reports, analytical summaries, and DPR-format documents.
 */
import { useState, useEffect } from 'react';
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

  // DPR Export tab state
  const [dprStart, setDprStart] = useState('');
  const [dprEnd, setDprEnd] = useState('');
  const [dprExporting, setDprExporting] = useState(false);
  const [dprError, setDprError] = useState('');

  // Intel tab state
  const [intelLogs, setIntelLogs] = useState([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [stations, setStations] = useState([]);
  const [offenders, setOffenders] = useState([]);
  const [intelPsId, setIntelPsId] = useState('');
  const [intelSourceType, setIntelSourceType] = useState('INFORMER');
  const [intelOffenderId, setIntelOffenderId] = useState('');
  const [intelSupplyRoute, setIntelSupplyRoute] = useState('');
  const [intelInputText, setIntelInputText] = useState('');
  const [intelSubmitting, setIntelSubmitting] = useState(false);
  const [intelSubmitError, setIntelSubmitError] = useState('');
  const [intelSubmitSuccess, setIntelSubmitSuccess] = useState(false);

  // Reports states for Custom Builder
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customPsId, setCustomPsId] = useState('ALL');
  const [customContraband, setCustomContraband] = useState('ALL');
  const [customStage, setCustomStage] = useState('ALL');
  const [customData, setCustomData] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customExporting, setCustomExporting] = useState(false);
  const [customColumns, setCustomColumns] = useState({
    firNo: true,
    caseDate: true,
    sectionOfLaw: true,
    stage: true,
    psName: true,
    accusedName: true,
    age: true,
    contrabandType: true,
    quantity: true,
    cashAmount: true,
  });

  // Reports states for Court Diary
  const [courtDays, setCourtDays] = useState(30);
  const [courtData, setCourtData] = useState([]);
  const [courtLoading, setCourtLoading] = useState(false);

  // Reports states for Performance
  const [perfData, setPerfData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'intel') {
      loadIntelFormData();
      fetchIntelLogs();
    } else if (activeTab === 'court') {
      fetchCourtDiary();
    } else if (activeTab === 'performance') {
      fetchPerformance();
    } else if (activeTab === 'custom') {
      loadIntelFormData(); // Reuse PS loading
    }
  }, [activeTab, courtDays]);

  const fetchCourtDiary = async () => {
    setCourtLoading(true);
    try {
      const res = await api.get(`/reports/court-diary?days=${courtDays}`);
      setCourtData(res.data.data?.hearings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setCourtLoading(false);
    }
  };

  const fetchPerformance = async () => {
    setPerfLoading(true);
    try {
      const res = await api.get(`/reports/performance`);
      setPerfData(res.data.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setPerfLoading(false);
    }
  };

  const handleCustomReport = async (exportXlsx = false) => {
    if (exportXlsx) {
      setCustomExporting(true);
    } else {
      setCustomLoading(true);
    }

    try {
      const params = {
        startDate: customStart,
        endDate: customEnd,
        psId: customPsId,
        contrabandType: customContraband,
        stage: customStage,
        format: exportXlsx ? 'xlsx' : 'json'
      };

      if (exportXlsx) {
        const res = await api.get('/reports/custom', { params, responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `custom-report-${Date.now()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const res = await api.get('/reports/custom', { params });
        setCustomData(res.data.data?.records || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCustomLoading(false);
      setCustomExporting(false);
    }
  };

  const loadIntelFormData = async () => {
    try {
      const psRes = await api.get('/police-stations');
      setStations(psRes.data.data || []);

      const offRes = await api.get('/offenders', { params: { size: 100 } });
      const offPayload = offRes.data.data;
      setOffenders(offPayload?.content || (Array.isArray(offPayload) ? offPayload : []));
    } catch (err) {
      console.error('Failed to load form data', err);
    }
  };

  const fetchIntelLogs = async () => {
    setIntelLoading(true);
    try {
      const res = await api.get('/intelligence');
      setIntelLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIntelLoading(false);
    }
  };

  const handleIntelSubmit = async (e) => {
    e.preventDefault();
    setIntelSubmitting(true);
    setIntelSubmitError('');
    setIntelSubmitSuccess(false);

    try {
      await api.post('/intelligence', {
        psId: intelPsId,
        sourceType: intelSourceType,
        offenderId: intelOffenderId || null,
        supplyRoute: intelSupplyRoute || null,
        inputText: intelInputText || null,
      });
      setIntelSubmitSuccess(true);
      setIntelSupplyRoute('');
      setIntelInputText('');
      setIntelOffenderId('');
      fetchIntelLogs();
    } catch (err) {
      setIntelSubmitError(err.response?.data?.message || 'Failed to record intelligence input');
    } finally {
      setIntelSubmitting(false);
    }
  };

  const handleDprExport = async () => {
    setDprExporting(true);
    setDprError('');
    try {
      const res = await api.get(`/reports/dpr-export`, {
        params: { startDate: dprStart, endDate: dprEnd },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dpr-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDprError('Failed to export DPR Excel');
    } finally {
      setDprExporting(false);
    }
  };

  const generateReport = async (reportKey) => {
    setActiveReport(reportKey);
    setReportLoading(true);
    setReportError('');
    setReportData(null);

    let endpoint = '';
    if (reportKey === 'absconder') endpoint = '/reports/absconder-list';
    else if (reportKey === 'monthly') endpoint = '/reports/monthly-abstract';
    else if (reportKey === 'yearly') endpoint = '/reports/yearly-comparison';
    else if (reportKey === 'pending_cs') endpoint = '/reports/pending-charge-sheets';
    else if (reportKey === 'bail_expiry') endpoint = '/reports/bail-expiry-alerts';
    else if (reportKey === 'court_pending') endpoint = '/reports/court-pending';
    else if (reportKey === 'seizure') endpoint = '/reports/drug-seizures';
    else if (reportKey === 'top_offenders') endpoint = '/reports/top-offenders';

    if (!endpoint) {
      setReportError('Report type not supported');
      setReportLoading(false);
      return;
    }

    try {
      const res = await api.get(endpoint);
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
                className="card card-hover rounded-xl p-5 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: report.color + '14' }}
                  >
                    <report.Icon size={20} color={report.color} />
                  </div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{report.name}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{report.desc}</p>
                </div>
                <button
                  className="btn btn-secondary btn-sm mt-3 w-fit"
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
            <div className="card rounded-xl overflow-hidden animate-fade-in border border-slate-100/50 dark:border-slate-800">
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
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-garuda-500)' }}>
                            Generated: {new Date().toLocaleString('en-IN')}
                          </p>
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
                      <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="table-header">
                              <th>#</th>
                              <th>Offender</th>
                              <th>Age</th>
                              <th>Father/Husband</th>
                              <th>FIR No</th>
                              <th>PS</th>
                              <th>Case Date</th>
                              <th>Section</th>
                              <th className="text-center">Days</th>
                              <th className="text-center">Severity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.absconders.map((a, i) => {
                              const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.LOW;
                              return (
                                <tr key={a.id} className="table-row">
                                  <td style={{ color: 'var(--color-garuda-400)' }}>{i + 1}</td>
                                  <td>
                                    <p className="font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{a.offenderName}</p>
                                    {a.alias && <p className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>alias: {a.alias}</p>}
                                  </td>
                                  <td style={{ color: 'var(--color-garuda-300)' }}>{a.age || '—'}</td>
                                  <td style={{ color: 'var(--color-garuda-300)' }}>{a.fatherName || '—'}</td>
                                  <td className="font-mono font-bold" style={{ color: 'var(--color-garuda-100)' }}>{a.firNo}</td>
                                  <td style={{ color: 'var(--color-garuda-300)' }}>{a.psName}</td>
                                  <td style={{ color: 'var(--color-garuda-300)' }}>
                                    {a.caseDate ? new Date(a.caseDate).toLocaleDateString('en-IN') : '—'}
                                  </td>
                                  <td style={{ color: 'var(--color-garuda-300)' }}>{a.sectionOfLaw || '—'}</td>
                                  <td className="text-center">
                                    <span className="text-sm font-bold" style={{ color: sev.color }}>{a.daysOutstanding}d</span>
                                  </td>
                                  <td className="text-center">
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

                {/* Monthly Case Abstract */}
                {activeReport === 'monthly' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-800/40 rounded-lg text-xs text-slate-300">
                      Month abstract for: <span className="font-bold text-white">{reportData.month}</span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>Station Name</th>
                            <th className="text-center">Cases Registered</th>
                            <th className="text-center">Arrests Made</th>
                            <th className="text-right">Contraband Seized</th>
                            <th className="text-right">Cash Seized</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-6 text-slate-500">No cases this month</td>
                            </tr>
                          ) : (
                            reportData.data.map((r, i) => (
                              <tr key={i} className="table-row">
                                <td className="font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{r.stationName}</td>
                                <td className="text-center font-semibold" style={{ color: 'var(--color-garuda-200)' }}>{r.caseCount}</td>
                                <td className="text-center font-semibold" style={{ color: 'var(--color-garuda-200)' }}>{r.arrestCount}</td>
                                <td className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">{r.contrabandKg.toFixed(3)} KG</td>
                                <td className="text-right text-amber-600 dark:text-amber-400 font-semibold">₹{r.cashAmount.toLocaleString('en-IN')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Yearly Comparative Chart */}
                {activeReport === 'yearly' && reportData && !reportLoading && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      {reportData.data.map((r) => {
                        const maxCases = Math.max(...reportData.data.map(d => d.cases), 1);
                        const percent = (r.cases / maxCases) * 100;
                        return (
                          <div key={r.year} className="p-4 rounded-xl space-y-2 border border-slate-100/50 dark:border-slate-800" style={{ background: 'var(--color-garuda-800)' }}>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-sm" style={{ color: 'var(--color-garuda-100)' }}>{r.year}</span>
                              <span style={{ color: 'var(--color-garuda-400)' }}>
                                Cases: <strong style={{ color: 'var(--color-garuda-100)' }}>{r.cases}</strong> |
                                Arrests: <strong style={{ color: 'var(--color-garuda-100)' }}>{r.arrests}</strong> |
                                Convictions: <strong className="text-emerald-600 dark:text-emerald-400">{r.convictions}</strong>
                              </span>
                            </div>
                            <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--color-garuda-600)' }}>
                              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pending Charge Sheets */}
                {activeReport === 'pending_cs' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>FIR No</th>
                            <th>Police Station</th>
                            <th>Section</th>
                            <th>Case Date</th>
                            <th className="text-center">Days Pending</th>
                            <th>Accused Names</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-500">No pending charge sheets beyond 60 days</td>
                            </tr>
                          ) : (
                            reportData.data.map((r) => (
                              <tr key={r.id} className="table-row">
                                <td className="font-mono font-bold text-slate-900 dark:text-white">{r.firNo}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.psName}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.sectionOfLaw}</td>
                                <td style={{ color: 'var(--color-garuda-400)' }}>
                                  {r.caseDate ? new Date(r.caseDate).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td className="text-center font-bold text-amber-600 dark:text-amber-400">{r.daysPending}d</td>
                                <td className="truncate max-w-[200px]" style={{ color: 'var(--color-garuda-400)' }}>{r.accusedNames || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bail Expiry Alert */}
                {activeReport === 'bail_expiry' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>Offender Name</th>
                            <th>FIR No</th>
                            <th>Police Station</th>
                            <th>Bail Date</th>
                            <th>Days on Bail</th>
                            <th>Conditions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-500">No active bail records</td>
                            </tr>
                          ) : (
                            reportData.data.map((r) => (
                              <tr key={r.id} className="table-row">
                                <td className="font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{r.offenderName}</td>
                                <td className="font-mono text-slate-900 dark:text-white">{r.firNo}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.psName}</td>
                                <td style={{ color: 'var(--color-garuda-400)' }}>
                                  {r.bailDate ? new Date(r.bailDate).toLocaleDateString('en-IN') : '—'}
                                </td>
                                <td style={{ color: 'var(--color-garuda-200)' }}>{r.daysSinceBail} days</td>
                                <td className="text-xs truncate max-w-[250px]" style={{ color: 'var(--color-garuda-400)' }}>{r.bailConditions}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Court Pending List */}
                {activeReport === 'court_pending' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>FIR No</th>
                            <th>Police Station</th>
                            <th>Section</th>
                            <th>SC/PR Number</th>
                            <th>Court Name</th>
                            <th>Next Hearing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-500">No cases pending in court trial</td>
                            </tr>
                          ) : (
                            reportData.data.map((r) => (
                              <tr key={r.id} className="table-row">
                                <td className="font-mono font-bold text-slate-900 dark:text-white">{r.firNo}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.psName}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.sectionOfLaw}</td>
                                <td className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>{r.scNumber}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.courtName}</td>
                                <td className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                  {r.nextHearingDate ? new Date(r.nextHearingDate).toLocaleDateString('en-IN') : '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Drug Seizure Summary */}
                {activeReport === 'seizure' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-800/40 rounded-lg text-xs text-slate-300">
                      Total Contraband Seized: <span className="font-bold text-emerald-400">{reportData.totalKg.toFixed(3)} KG</span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>Contraband Type</th>
                            <th className="text-right">Seized Quantity</th>
                            <th className="text-right">Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-6 text-slate-500">No seizures recorded</td>
                            </tr>
                          ) : (
                            reportData.data.map((r, i) => (
                              <tr key={i} className="table-row">
                                <td className="font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{r.type}</td>
                                <td className="text-right text-emerald-600 dark:text-emerald-400 font-bold">{r.amount.toFixed(3)} KG</td>
                                <td className="text-right" style={{ color: 'var(--color-garuda-400)' }}>{r.percentage}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top 10 Repeat Offenders */}
                {activeReport === 'top_offenders' && reportData && !reportLoading && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100/50 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="table-header">
                            <th>Sl.No</th>
                            <th>Offender Name</th>
                            <th>Alias</th>
                            <th>Father/Husband Name</th>
                            <th>Police Station</th>
                            <th className="text-center">Risk Score</th>
                            <th className="text-center">Cases Logged</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.data.map((r, i) => {
                            const s = SEVERITY_STYLES[r.riskScore] || SEVERITY_STYLES.LOW;
                            return (
                              <tr key={r.id} className="table-row">
                                <td style={{ color: 'var(--color-garuda-400)' }}>{i + 1}</td>
                                <td className="font-bold text-slate-900 dark:text-white">{r.offenderName}</td>
                                <td style={{ color: 'var(--color-garuda-400)' }}>{r.alias || '—'}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.fatherName || '—'}</td>
                                <td style={{ color: 'var(--color-garuda-300)' }}>{r.psName}</td>
                                <td className="text-center">
                                  <span
                                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                                  >
                                    {r.riskScore}
                                  </span>
                                </td>
                                <td className="text-center text-amber-600 dark:text-amber-400 font-bold text-base">{r.caseCount}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* DPR Export Tab */}
      {activeTab === 'dpr' && (
        <div className="card rounded-xl p-6 space-y-4 border border-slate-100/50 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Daily Progress Report (DPR) Export</h2>
            <p className="text-xs text-slate-400 mt-1">Export cases matching the daily progress spreadsheet format</p>
          </div>
          <div className="flex flex-wrap gap-4 items-end bg-slate-800/30 p-4 rounded-xl border border-slate-100/50 dark:border-slate-800">
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs text-slate-400 font-semibold">Start Date</label>
              <input
                type="date"
                value={dprStart}
                onChange={(e) => setDprStart(e.target.value)}
                className="input w-full"
              />
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <label className="text-xs text-slate-400 font-semibold">End Date</label>
              <input
                type="date"
                value={dprEnd}
                onChange={(e) => setDprEnd(e.target.value)}
                className="input w-full"
              />
            </div>
            <button
              onClick={handleDprExport}
              disabled={dprExporting}
              className="btn btn-primary h-[38px] flex items-center gap-2"
            >
              {dprExporting ? 'Exporting...' : '⬇ Export DPR Excel'}
            </button>
          </div>
          {dprError && (
            <div className="text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-3 rounded-lg">
              {dprError}
            </div>
          )}
        </div>
      )}

      {/* Intelligence Summary Tab */}
      {activeTab === 'intel' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Intel Form */}
            <div className="card rounded-xl p-5 space-y-4 h-fit border border-slate-100/50 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Record Intelligence Input</h3>
              <form onSubmit={handleIntelSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Police Station *</label>
                  <select
                    required
                    value={intelPsId}
                    onChange={(e) => setIntelPsId(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">Select Station</option>
                    {stations.map(ps => (
                      <option key={ps.id} value={ps.id}>{ps.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Source Type *</label>
                  <select
                    required
                    value={intelSourceType}
                    onChange={(e) => setIntelSourceType(e.target.value)}
                    className="select w-full"
                  >
                    <option value="INFORMER">Informer</option>
                    <option value="FIELD_OFFICER">Field Officer</option>
                    <option value="SB">Special Branch (SB)</option>
                    <option value="EXCISE">Excise</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Associated Offender (Optional)</label>
                  <select
                    value={intelOffenderId}
                    onChange={(e) => setIntelOffenderId(e.target.value)}
                    className="select w-full"
                  >
                    <option value="">None</option>
                    {offenders.map(o => (
                      <option key={o.id} value={o.id}>{o.fullName || o.full_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Supply Route / Location</label>
                  <input
                    type="text"
                    value={intelSupplyRoute}
                    placeholder="e.g. Odisha -> Tirupati via NH-16"
                    onChange={(e) => setIntelSupplyRoute(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold">Intelligence Input Text</label>
                  <textarea
                    rows={3}
                    value={intelInputText}
                    placeholder="Provide details about suspects, timings, or modus operandi..."
                    onChange={(e) => setIntelInputText(e.target.value)}
                    className="textarea w-full text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={intelSubmitting}
                  className="btn btn-primary w-full"
                >
                  {intelSubmitting ? 'Recording...' : 'Submit Intel Input'}
                </button>
                {intelSubmitError && (
                  <p className="text-xs text-red-400 text-center">{intelSubmitError}</p>
                )}
                {intelSubmitSuccess && (
                  <p className="text-xs text-emerald-400 text-center">Recorded successfully!</p>
                )}
              </form>
            </div>

            {/* Intel Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Intelligence Logs</h3>
                <button onClick={fetchIntelLogs} className="btn btn-secondary btn-sm">🔄 Refresh</button>
              </div>
              {intelLoading ? (
                <div className="card rounded-xl p-8 text-center text-slate-400 border border-slate-100/50 dark:border-slate-800">Loading intelligence logs...</div>
              ) : intelLogs.length === 0 ? (
                <div className="card rounded-xl p-8 text-center text-slate-500 border border-slate-100/50 dark:border-slate-800">No intelligence inputs recorded yet</div>
              ) : (
                <div className="grid grid-cols-1 gap-4 text-left">
                  {intelLogs.map((log) => (
                    <div key={log.id} className="card rounded-xl p-4 border border-slate-100/50 dark:border-slate-800/80 space-y-3" style={{ background: 'var(--color-garuda-800)' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-750 mr-2 uppercase tracking-wide">
                            {log.sourceType}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{log.psName}</span>
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>
                          {new Date(log.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{log.inputText}</p>
                      <div className="flex flex-wrap gap-4 text-xs pt-1 border-t border-slate-100/50 dark:border-slate-800/80" style={{ color: 'var(--color-garuda-400)' }}>
                        <div>
                          <span className="font-semibold" style={{ color: 'var(--color-garuda-400)' }}>Offender:</span> <span className="font-medium" style={{ color: 'var(--color-garuda-200)' }}>{log.offenderName}</span>
                        </div>
                        {log.supplyRoute && (
                          <div>
                            <span className="font-semibold" style={{ color: 'var(--color-garuda-400)' }}>Route:</span> <span className="font-medium" style={{ color: 'var(--color-garuda-200)' }}>{log.supplyRoute}</span>
                          </div>
                        )}
                        <div className="ml-auto">
                          <span className="font-semibold" style={{ color: 'var(--color-garuda-400)' }}>By:</span> <span className="font-medium" style={{ color: 'var(--color-garuda-200)' }}>{log.createdByName}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Builder Tab */}
      {activeTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls Panel */}
          <div className="card rounded-xl p-5 border border-slate-100/50 dark:border-slate-800 space-y-4 h-fit">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Filters & Columns</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Date Range</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="input text-xs w-full"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="input text-xs w-full"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Police Station</label>
                <select
                  value={customPsId}
                  onChange={(e) => setCustomPsId(e.target.value)}
                  className="select text-xs w-full"
                >
                  <option value="ALL">All Stations</option>
                  {stations.map(ps => (
                    <option key={ps.id} value={ps.id}>{ps.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Contraband Type</label>
                <select
                  value={customContraband}
                  onChange={(e) => setCustomContraband(e.target.value)}
                  className="select text-xs w-full"
                >
                  <option value="ALL">All Contraband</option>
                  <option value="DRY_GANJA">Dry Ganja</option>
                  <option value="GANJA_OIL">Ganja Oil</option>
                  <option value="BROWN_SUGAR">Brown Sugar</option>
                  <option value="HEROIN">Heroin</option>
                  <option value="MDMA">MDMA</option>
                  <option value="SYNTHETIC">Synthetic</option>
                  <option value="COCAINE">Cocaine</option>
                  <option value="OPIUM">Opium</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Case Stage</label>
                <select
                  value={customStage}
                  onChange={(e) => setCustomStage(e.target.value)}
                  className="select text-xs w-full"
                >
                  <option value="ALL">All Stages</option>
                  <option value="FIR">FIR</option>
                  <option value="CHARGESHEET">Charge Sheet</option>
                  <option value="TRIAL">Trial</option>
                  <option value="CONVICTED">Convicted</option>
                  <option value="ACQUITTED">Acquitted</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-700">
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Select Columns</label>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-left">
                  {Object.keys(customColumns).map((col) => (
                    <label key={col} className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={customColumns[col]}
                        onChange={(e) => setCustomColumns({ ...customColumns, [col]: e.target.checked })}
                        className="rounded border-slate-750 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                      />
                      <span className="capitalize">{col.replace(/([A-Z])/g, ' $1')}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-3">
              <button
                onClick={() => handleCustomReport(false)}
                disabled={customLoading}
                className="btn btn-primary w-full h-[38px]"
              >
                {customLoading ? 'Running...' : 'Run Custom Report'}
              </button>
              <button
                onClick={() => handleCustomReport(true)}
                disabled={customExporting}
                className="btn btn-secondary w-full h-[38px] border border-slate-700 hover:bg-slate-700/50"
              >
                {customExporting ? 'Exporting...' : '⬇ Export to Excel'}
              </button>
            </div>
          </div>

          {/* Results Grid */}
          <div className="lg:col-span-3 card rounded-xl p-5 border border-slate-100/50 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--color-garuda-100)' }}>Custom Query Output</h3>
            {customLoading ? (
              <div className="py-24 text-center" style={{ color: 'var(--color-garuda-400)' }}>Querying database, please wait...</div>
            ) : customData.length === 0 ? (
              <div className="py-24 text-center" style={{ color: 'var(--color-garuda-400)' }}>Configure filters and click "Run Custom Report" above.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-garuda-700)' }}>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="table-header">
                      {customColumns.firNo && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>FIR No</th>}
                      {customColumns.caseDate && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Case Date</th>}
                      {customColumns.sectionOfLaw && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Section</th>}
                      {customColumns.stage && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Stage</th>}
                      {customColumns.psName && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Station</th>}
                      {customColumns.accusedName && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Accused</th>}
                      {customColumns.age && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Age</th>}
                      {customColumns.contrabandType && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Contraband</th>}
                      {customColumns.quantity && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Qty</th>}
                      {customColumns.cashAmount && <th className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Seized Cash</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {customData.map((row, idx) => (
                      <tr 
                        key={idx} 
                        className="table-row" 
                        style={{ 
                          background: idx % 2 === 0 ? 'transparent' : 'var(--color-garuda-800)' 
                        }}
                      >
                        {customColumns.firNo && (
                          <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
                            {row['FIR No']}
                          </td>
                        )}
                        {customColumns.caseDate && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Case Date']}
                          </td>
                        )}
                        {customColumns.sectionOfLaw && (
                          <td className="px-4 py-3 truncate max-w-[120px]" title={row['Section of Law']} style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Section of Law']}
                          </td>
                        )}
                        {customColumns.stage && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Stage']}
                          </td>
                        )}
                        {customColumns.psName && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Police Station']}
                          </td>
                        )}
                        {customColumns.accusedName && (
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                            {row['Accused Name']}
                          </td>
                        )}
                        {customColumns.age && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Age']}
                          </td>
                        )}
                        {customColumns.contrabandType && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Contraband Type']}
                          </td>
                        )}
                        {customColumns.quantity && (
                          <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                            {row['Quantity (KG)']}
                          </td>
                        )}
                        {customColumns.cashAmount && (
                          <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                            ₹{Number(row['Cash (INR)']).toLocaleString('en-IN')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Court Diary Tab */}
      {activeTab === 'court' && (
        <div className="card rounded-xl p-5 border border-slate-100/50 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Upcoming Court Hearings Diary</h3>
              <p className="text-xs text-slate-400">Detailed list of court trials scheduled in the near future</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Days:</span>
              <select
                value={courtDays}
                onChange={(e) => setCourtDays(parseInt(e.target.value))}
                className="select select-sm select-bordered"
                style={{ background: 'var(--color-garuda-800)', color: 'var(--color-garuda-100)' }}
              >
                <option value={7}>Next 7 Days</option>
                <option value={15}>Next 15 Days</option>
                <option value={30}>Next 30 Days</option>
              </select>
            </div>
          </div>

          {courtLoading ? (
            <div className="py-24 text-center text-slate-400">Fetching hearings diary...</div>
          ) : courtData.length === 0 ? (
            <div className="py-24 text-center text-slate-500">No upcoming court trials logged in the specified period.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courtData.map((h) => (
                <div key={h.id} className="card rounded-xl p-4 border border-slate-700/80 space-y-3" style={{ background: 'var(--color-garuda-800)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-750 mr-2 uppercase">
                        {h.scNumber}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">{h.courtName}</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-bold">
                      {new Date(h.hearingDate).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-100">FIR No: <span className="font-mono text-xs">{h.firNo}</span></p>
                    <p className="text-xs text-slate-400">Station: {h.psName}</p>
                    <p className="text-xs text-slate-300">Accused: <span className="font-medium text-slate-200">{h.accusedNames}</span></p>
                  </div>

                  {h.orderText && (
                    <div className="text-xs bg-slate-900/50 p-2.5 rounded-lg border border-slate-750/50 text-slate-300">
                      <strong className="block text-slate-400 mb-0.5">Trial Notes:</strong>
                      {h.orderText}
                    </div>
                  )}

                  {h.nextHearingDate && (
                    <div className="text-[11px] text-amber-500/90 font-medium flex items-center gap-1.5 pt-1 border-t border-slate-750">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Next Hearing: {new Date(h.nextHearingDate).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Performance Dashboard Tab */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {perfLoading ? (
            <div className="card rounded-xl p-24 text-center border border-slate-750">Calculating performance indicators...</div>
          ) : perfData ? (
            <>
              {/* Gauges & Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-5 border border-slate-700/80 space-y-2 flex flex-col justify-between" style={{ background: 'var(--color-garuda-800)' }}>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Scopes Registered</span>
                  <p className="text-3xl font-extrabold text-slate-100">{perfData.summary.totalCases}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Total active case records under department authority.</p>
                </div>

                <div className="card p-5 border border-slate-700/80 space-y-2 flex flex-col justify-between" style={{ background: 'var(--color-garuda-800)' }}>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Charge Sheet Filing Rate</span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-blue-400">{perfData.summary.chargeSheetRate}%</p>
                    <span className="text-xs text-slate-400">({perfData.summary.chargeSheetedCases}/{perfData.summary.totalCases})</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Filing rate within legal deadlines.</p>
                </div>

                <div className="card p-5 border border-slate-700/80 space-y-2 flex flex-col justify-between" style={{ background: 'var(--color-garuda-800)' }}>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Conviction Success Rate</span>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-extrabold text-emerald-400">{perfData.summary.convictionRate}%</p>
                    <span className="text-xs text-slate-400">({perfData.summary.convictedCases} Convicted)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Out of decided cases: {perfData.summary.convictedCases + perfData.summary.acquittedCases} trials.</p>
                </div>

                <div className="card p-5 border border-slate-700/80 space-y-2 flex flex-col justify-between" style={{ background: 'var(--color-garuda-800)' }}>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Filing Backlog</span>
                  <p className="text-3xl font-extrabold text-amber-500">{perfData.summary.totalCases - perfData.summary.chargeSheetedCases}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Cases remaining in FIR stage pending investigation.</p>
                </div>
              </div>

              {/* Station Leaders chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 card p-5 border border-slate-100/50 dark:border-slate-800" style={{ background: 'var(--color-garuda-800)' }}>
                  <h3 className="text-base font-bold text-slate-100 mb-4">Top 10 Active Stations Leaders</h3>
                  <div className="h-72 w-full text-xs">
                    {/* Render a custom Leaderboard Chart */}
                    <table className="w-full text-left text-slate-350">
                      <thead>
                        <tr className="border-b border-slate-700 font-semibold text-slate-200">
                          <th className="py-2">Rank</th>
                          <th className="py-2">Station Name</th>
                          <th className="py-2 text-center">Cases Logged</th>
                          <th className="py-2 text-right">Contraband Seized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {perfData.leaderboard.map((station, i) => (
                          <tr key={station.stationName} className="border-b border-slate-750/50 hover:bg-slate-700/10">
                            <td className="py-2.5 font-bold text-indigo-400">#{i + 1}</td>
                            <td className="py-2.5 font-semibold text-slate-100">{station.stationName}</td>
                            <td className="py-2.5 text-center font-bold text-slate-300">{station.casesCount}</td>
                            <td className="py-2.5 text-right font-bold text-emerald-400">{station.contrabandKg.toFixed(2)} KG</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-5 border border-slate-100/50 dark:border-slate-800 flex flex-col justify-between" style={{ background: 'var(--color-garuda-800)' }}>
                  <h3 className="text-base font-bold text-slate-100 mb-4">Trial Disposition Details</h3>
                  <div className="space-y-4 flex-1 flex flex-col justify-center">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-300">
                        <span>Convictions</span>
                        <span className="text-emerald-400 font-bold">{perfData.summary.convictedCases} Cases</span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden bg-slate-900">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{
                            width: `${(perfData.summary.convictedCases / Math.max(1, perfData.summary.convictedCases + perfData.summary.acquittedCases)) * 100}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-slate-300">
                        <span>Acquittals</span>
                        <span className="text-amber-500 font-bold">{perfData.summary.acquittedCases} Cases</span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden bg-slate-900">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${(perfData.summary.acquittedCases / Math.max(1, perfData.summary.convictedCases + perfData.summary.acquittedCases)) * 100}%`
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-700/60 bg-slate-900/50 text-[11px] text-slate-400 mt-4 leading-relaxed">
                      💡 <strong>Rate Analysis:</strong> The conviction success rate of {perfData.summary.convictionRate}% reflects trials decided in court. Backlog pending investigation includes {perfData.summary.totalCases - perfData.summary.chargeSheetedCases} cases in the FIR stage.
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">Failed to calculate performance parameters.</div>
          )}
        </div>
      )}
    </div>
  );
}
