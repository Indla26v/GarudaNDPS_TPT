/**
 * Admin — DPR Excel Import (Staged)
 *
 * Staged import process:
 * 1. Upload Excel -> Calls /preview to parse and return structured data.
 * 2. Preview Grid -> User can cross-check, inline-edit fields, and fix validation errors.
 * 3. Confirm / Cancel -> Calls /confirm to insert to DB, or discards the data.
 *
 * Also includes real-time SSE logs for the final import progress.
 */
import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useSSE } from '../../hooks/useSSE';

/* ────────────────────────────────────────────────── */
/*  Import Log Card                                   */
/* ────────────────────────────────────────────────── */
function ImportLogCard({ log, onDismiss }) {
  const [showErrors, setShowErrors] = useState(false);
  const hasErrors = log.errors && log.errors.length > 0;

  return (
    <div
      className="card rounded-xl p-4 border relative overflow-hidden transition-all duration-300"
      style={{
        background: 'var(--color-garuda-800)',
        borderColor: hasErrors ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
            style={{
              background: hasErrors ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: hasErrors ? '#f87171' : '#34d399',
            }}
          >
            {hasErrors ? '⚠️' : '✓'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
              {log.text}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--color-garuda-400)' }}>
              Received at {log.timestamp} • {hasErrors ? `${log.errors.length} item(s) logged` : 'Clean import'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDismiss(log.id)}
          className="text-xs hover:text-white cursor-pointer bg-transparent border-none text-slate-500"
        >
          ✕
        </button>
      </div>

      {hasErrors && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <button
            onClick={() => setShowErrors(!showErrors)}
            className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none text-left"
            style={{ color: 'var(--color-accent-400)' }}
          >
            {showErrors ? 'Hide details' : `Show logs / errors (${log.errors.length})`}
          </button>
          {showErrors && (
            <div
              className="mt-2 p-3 rounded-lg text-xs font-mono max-h-40 overflow-y-auto"
              style={{
                background: 'var(--color-garuda-950)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              {log.errors.map((err, idx) => (
                <div key={idx} className="py-0.5 border-b border-red-950/20 last:border-b-0">
                  {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── */
/*  Main DataImport Component    */
/* ────────────────────────────── */
export default function DataImport() {
  const fileInputRef = useRef(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importLogs, setImportLogs] = useState([]);
  const { lastEvent } = useSSE();

  /* ── SSE: listen for real-time import results from other sessions ── */
  useEffect(() => {
    if (lastEvent?.type === 'data_updated' && lastEvent?.data?.source === 'import') {
      const stats = lastEvent.data.stats;
      const logMessage = {
        id: 'sse_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `DPR Import Processed: Parsed ${stats.rows} rows, Created ${stats.casesCreated} cases, Registered ${stats.offendersCreated} offenders.`,
        errors: stats.errors || [],
      };
      setImportLogs((prev) => {
        const exists = prev.some((l) => l.text === logMessage.text);
        if (exists) return prev;
        return [logMessage, ...prev];
      });
    }
  }, [lastEvent]);

  /* ── Upload Handler (Preview) ── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setPreviewData(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/admin/import/dpr/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewData(res.data.data.rows);
    } catch (err) {
      console.error(err);
      const logMessage = {
        id: 'err_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        text: `Preview Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`,
        errors: [err.response?.data?.message || err.message || 'Unknown error'],
      };
      setImportLogs((prev) => [logMessage, ...prev]);
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Inline Editing ── */
  const handleFieldChange = (index, field, value) => {
    const newData = [...previewData];
    newData[index][field] = value;
    
    // Basic inline validation check
    if (field === 'crNo' || field === 'accusedName' || field === 'psName') {
      const errors = [];
      if (!newData[index].crNo || !newData[index].accusedName) errors.push('Missing "Cr. No." or "Accused Name"');
      if (!newData[index].psName) errors.push('Unknown station');
      newData[index].errors = errors;
      newData[index].isValid = errors.length === 0;
    }
    
    setPreviewData(newData);
  };

  /* ── Confirm Import ── */
  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const res = await api.post('/admin/import/dpr/confirm', { rows: previewData });
      const stats = res.data.data;
      const logMessage = {
        id: 'user_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'success',
        text: `DPR Import Completed: Processed ${stats.rows} rows, Created ${stats.casesCreated} cases, Registered ${stats.offendersCreated} offenders.`,
        errors: stats.errors || [],
      };
      setImportLogs((prev) => {
        const exists = prev.some((l) => l.text === logMessage.text);
        if (exists) return prev;
        return [logMessage, ...prev];
      });
      setPreviewData(null);
    } catch (err) {
      console.error(err);
      const logMessage = {
        id: 'err_' + Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        text: `Import Failed: ${err.response?.data?.message || err.message || 'Unknown error'}`,
        errors: [err.response?.data?.message || err.message || 'Unknown error'],
      };
      setImportLogs((prev) => [logMessage, ...prev]);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Cancel Import ── */
  const handleCancel = () => {
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            DPR Data Import
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Staged Import: Upload Excel, cross-check the parsed data, and approve to insert into the database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isParsing ? (
            <span
              className="text-xs animate-pulse font-semibold self-center px-4"
              style={{ color: 'var(--color-accent-400)' }}
            >
              Parsing Excel...
            </span>
          ) : !previewData ? (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary btn-sm"
              >
                Upload & Preview
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Preview Grid ── */}
      {previewData && (
        <div className="card rounded-xl overflow-hidden animate-fade-in" style={{ border: '1px solid var(--color-garuda-700)', background: 'var(--color-garuda-900)' }}>
          <div className="p-4 flex items-center justify-between" style={{ background: 'var(--color-garuda-800)', borderBottom: '1px solid var(--color-garuda-700)' }}>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--color-garuda-100)' }}>Cross-check Data</h2>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                {previewData.length} rows found. Correct any red fields before approving.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="btn btn-secondary btn-sm"
              >
                Cancel Import
              </button>
              <button
                onClick={handleApprove}
                disabled={isSaving}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? 'Importing...' : 'Approve & Save to DB'}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[70vh] custom-scrollbar rounded-b-xl" style={{ background: 'var(--color-garuda-900)' }}>
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 z-20" style={{ background: 'var(--color-garuda-800)', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                <tr>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b whitespace-nowrap" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Row</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b whitespace-nowrap" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Status</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[100px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>CR No.</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[140px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>PS Name</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[120px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Sec. of Law</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[160px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Accused Name</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[140px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Guardian Name</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[100px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Caste</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[70px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Age</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[120px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Phone</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[140px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Email</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[200px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Address Line</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[120px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>Mandal</th>
                  <th className="px-3 py-3 font-semibold text-[11px] tracking-wider uppercase border-b min-w-[120px]" style={{ color: 'var(--color-garuda-400)', borderColor: 'var(--color-garuda-700)' }}>District</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-garuda-700)' }}>
                {previewData.map((row, idx) => (
                  <tr key={row.id} className="transition-colors group hover:bg-slate-100 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--color-garuda-500)' }}>
                      #{row.originalRow}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }}></span> Ready
                        </span>
                      ) : (
                        <div className="group/err relative inline-block">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-help" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }}></span> Error
                          </span>
                          <div className="absolute hidden group-hover/err:block z-30 w-56 p-3 mt-2 rounded-xl text-xs shadow-2xl left-0 font-medium" style={{ background: 'var(--color-garuda-800)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
                            {row.errors.map((e, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-1 last:mb-0">
                                <span>•</span>
                                <span>{e}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.crNo} 
                        onChange={(e) => handleFieldChange(idx, 'crNo', e.target.value)}
                        className={`w-full bg-transparent outline-none px-2 py-1.5 rounded-md border transition-all text-xs font-medium focus:ring-2 focus:ring-blue-500/30 ${
                          !row.crNo 
                            ? 'border-red-400 bg-red-50 text-red-600 placeholder-red-400 dark:border-red-500/40 dark:bg-red-500/5 dark:text-red-400 dark:placeholder-red-700' 
                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500'
                        }`}
                        style={{ color: row.crNo ? 'var(--color-garuda-200)' : undefined }}
                        placeholder="CR No."
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.psName || row.psCode} 
                        onChange={(e) => handleFieldChange(idx, 'psName', e.target.value)}
                        className={`w-full bg-transparent outline-none px-2 py-1.5 rounded-md border transition-all text-xs font-medium focus:ring-2 focus:ring-blue-500/30 ${
                          !row.psId 
                            ? 'border-red-400 bg-red-50 text-red-600 placeholder-red-400 dark:border-red-500/40 dark:bg-red-500/5 dark:text-red-400 dark:placeholder-red-700' 
                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500'
                        }`}
                        style={{ color: row.psId ? 'var(--color-garuda-200)' : undefined }}
                        placeholder="PS Name"
                        title={!row.psId ? "Police Station not found in DB" : "Valid PS"}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.secOfLaw} 
                        onChange={(e) => handleFieldChange(idx, 'secOfLaw', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-200)' }}
                        placeholder="Section"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedName || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedName', e.target.value)}
                        className={`w-full bg-transparent outline-none px-2 py-1.5 rounded-md border transition-all text-xs focus:ring-2 focus:ring-blue-500/30 ${
                          !row.accusedName 
                            ? 'border-red-400 bg-red-50 text-red-600 placeholder-red-400 dark:border-red-500/40 dark:bg-red-500/5 dark:text-red-400 dark:placeholder-red-700' 
                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500'
                        }`}
                        style={{ color: row.accusedName ? 'var(--color-garuda-300)' : undefined }}
                        placeholder="Name"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedGuardian || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedGuardian', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Guardian Name"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedCaste || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedCaste', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Caste"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="number" 
                        value={row.accusedAge || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedAge', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Age"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedPhone || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedPhone', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Phone"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="email" 
                        value={row.accusedEmail || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedEmail', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Email"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedAddress || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedAddress', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Address Line"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedMandal || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedMandal', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="Mandal"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input 
                        type="text" 
                        value={row.accusedDistrict || ''} 
                        onChange={(e) => handleFieldChange(idx, 'accusedDistrict', e.target.value)}
                        className="w-full bg-transparent outline-none px-2 py-1.5 rounded-md border border-transparent transition-all text-xs hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                        style={{ color: 'var(--color-garuda-300)' }}
                        placeholder="District"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Real-time Import Logs ── */}
      {importLogs.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Real-time Import Logs
              </h3>
            </div>
            <button
              onClick={() => setImportLogs([])}
              className="text-xs hover:underline cursor-pointer border-none bg-transparent text-slate-400"
            >
              Clear Logs
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {importLogs.map((log) => (
              <ImportLogCard
                key={log.id}
                log={log}
                onDismiss={(id) => setImportLogs((prev) => prev.filter((l) => l.id !== id))}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Instructions Card (Hidden when previewing) ── */}
      {!previewData && (
        <div
          className="rounded-xl p-6 space-y-4"
          style={{
            background: 'var(--color-garuda-800)',
            border: '1px solid var(--color-garuda-700)',
          }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-200)' }}>
            How it works
          </h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--color-garuda-400)' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--color-accent-400)' }}>①</span>
              Click <strong style={{ color: 'var(--color-garuda-200)' }}>Upload & Preview</strong> and select your DPR spreadsheet (.xlsx, .xls, or .csv).
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--color-accent-400)' }}>②</span>
              Cross-check the structured data in the preview grid. Edit any cells that were parsed incorrectly.
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--color-accent-400)' }}>③</span>
              Click <strong style={{ color: 'var(--color-garuda-200)' }}>Approve & Save</strong> to finalize the import, or <strong style={{ color: 'var(--color-garuda-200)' }}>Cancel Import</strong> to discard.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
