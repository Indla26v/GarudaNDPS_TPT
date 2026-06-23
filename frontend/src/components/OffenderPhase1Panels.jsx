import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const inputStyle = {
  background: 'var(--color-garuda-900)',
  border: '1px solid var(--color-garuda-600)',
  color: 'var(--color-garuda-100)',
};

export function OffenderCaseHistory({ offenderId, isEdit }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cases/offender/${offenderId}`)
      .then((r) => setCases(r.data.data || []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [offenderId]);

  const handleStatusChange = async (caseId, newStatus) => {
    try {
      const targetCase = cases.find(item => item.id === caseId);
      if (!targetCase) return;

      const updatedAccused = targetCase.accused.map(a => {
        if (String(a.offenderId) === String(offenderId)) {
          return { ...a, arrestStatus: newStatus };
        }
        return a;
      });

      await api.post(`/cases/${caseId}/accused`, updatedAccused);

      setCases(prevCases => prevCases.map(item => {
        if (item.id === caseId) {
          return {
            ...item,
            accused: item.accused.map(a =>
              String(a.offenderId) === String(offenderId)
                ? { ...a, arrestStatus: newStatus }
                : a
            )
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Failed to update arrest status', err);
    }
  };

  if (loading) return <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Loading case history...</p>;
  if (!cases.length) return <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No linked cases</p>;

  return (
    <ul className="space-y-2">
      {cases.map((c) => {
        const offenderAccusedObj = c.accused?.find(a => String(a.offenderId) === String(offenderId));
        const arrestStatus = offenderAccusedObj?.arrestStatus || 'ARRESTED';

        return (
          <li key={c.id} className="p-3 rounded-lg flex items-center justify-between gap-4" style={{ background: 'var(--color-garuda-900)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--color-garuda-100)' }}>{c.firNo}</p>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                {c.psName} • {c.stage} • {c.caseDate ? new Date(c.caseDate).toLocaleDateString('en-IN') : '—'}
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              {isEdit ? (
                <select
                  value={arrestStatus}
                  onChange={(e) => handleStatusChange(c.id, e.target.value)}
                  className="px-2 py-1 rounded-md text-xs font-semibold outline-none cursor-pointer"
                  style={{
                    background: arrestStatus === 'ABSCONDING' ? 'rgba(239,68,68,0.15)' : arrestStatus === 'BAILED' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                    color: arrestStatus === 'ABSCONDING' ? '#ef4444' : arrestStatus === 'BAILED' ? '#f59e0b' : '#22c55e',
                    border: `1px solid ${arrestStatus === 'ABSCONDING' ? 'rgba(239,68,68,0.3)' : arrestStatus === 'BAILED' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  }}
                >
                  <option value="ARRESTED">Arrested</option>
                  <option value="ABSCONDING">Absconding</option>
                  <option value="BAILED">Bailed</option>
                </select>
              ) : (
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{
                    background: arrestStatus === 'ABSCONDING' ? 'rgba(239,68,68,0.15)' : arrestStatus === 'BAILED' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
                    color: arrestStatus === 'ABSCONDING' ? '#ef4444' : arrestStatus === 'BAILED' ? '#f59e0b' : '#22c55e',
                    border: `1px solid ${arrestStatus === 'ABSCONDING' ? 'rgba(239,68,68,0.3)' : arrestStatus === 'BAILED' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  }}
                >
                  {arrestStatus.charAt(0) + arrestStatus.slice(1).toLowerCase()}
                </span>
              )}

              <Link to={`/cases/${c.id}`} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}>
                View
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function OffenderInterrogationPanel({ offenderId }) {
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ sourceInfo: '', notes: '', paymentMode: '', deliveryMode: '' });
  const [msg, setMsg] = useState('');

  const load = () => {
    api.get(`/offenders/${offenderId}/interrogations`)
      .then((r) => setSessions(r.data.data || []))
      .catch(() => setSessions([]));
  };

  useEffect(() => { load(); }, [offenderId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/offenders/${offenderId}/interrogations`, form);
      setForm({ sourceInfo: '', notes: '', paymentMode: '', deliveryMode: '' });
      setMsg('Session saved');
      load();
    } catch {
      setMsg('Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      {sessions.map((s) => (
        <div key={s.id} className="p-3 rounded-lg text-sm" style={{ background: 'var(--color-garuda-900)' }}>
          <p style={{ color: 'var(--color-garuda-200)' }}>{new Date(s.sessionAt).toLocaleString('en-IN')} — {s.officerName || 'Officer'}</p>
          {s.sourceInfo && <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Source: {s.sourceInfo}</p>}
          {s.notes && <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{s.notes}</p>}
        </div>
      ))}
      <form onSubmit={submit} className="grid gap-3">
        <input placeholder="Source of contraband" className="px-3 py-2 rounded text-sm" style={inputStyle} value={form.sourceInfo} onChange={(e) => setForm((f) => ({ ...f, sourceInfo: e.target.value }))} />
        <input placeholder="Payment mode" className="px-3 py-2 rounded text-sm" style={inputStyle} value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))} />
        <input placeholder="Delivery mode" className="px-3 py-2 rounded text-sm" style={inputStyle} value={form.deliveryMode} onChange={(e) => setForm((f) => ({ ...f, deliveryMode: e.target.value }))} />
        <textarea placeholder="Notes" rows={2} className="px-3 py-2 rounded text-sm" style={inputStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <button type="submit" className="px-4 py-2 rounded text-sm text-white w-fit" style={{ background: 'var(--color-accent-500)' }}>Save Interrogation</button>
      </form>
    </div>
  );
}

export function ImeiPanel({ offenderId, isEdit }) {
  const [imeiRecords, setImeiRecords] = useState([]);
  const [form, setForm] = useState({ imeiNumber: '', deviceMake: '', deviceModel: '', simNumber: '', simProvider: '', mobileNumber: '', notes: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(`/offenders/${offenderId}/imei`)
      .then((r) => setImeiRecords(r.data.data || []))
      .catch(() => setImeiRecords([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [offenderId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/offenders/${offenderId}/imei`, form);
      setForm({ imeiNumber: '', deviceMake: '', deviceModel: '', simNumber: '', simProvider: '', mobileNumber: '', notes: '' });
      setMsg('IMEI record added');
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to add IMEI');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/offenders/${offenderId}/imei/${id}`, { status });
      load();
    } catch (err) {
      setMsg('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'ACTIVE': return { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' };
      case 'SWAPPED': return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
      case 'SUSPICIOUS': return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' };
      default: return { bg: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' };
    }
  };

  if (loading) return <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Loading IMEI records...</p>;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      
      {/* Existing Records */}
      {imeiRecords.length === 0 ? (
        <p className="text-sm text-slate-400">No IMEI records found.</p>
      ) : (
        <div className="space-y-3">
          {imeiRecords.map((r) => {
            const st = getStatusColor(r.status);
            return (
              <div key={r.id} className="p-3 rounded-lg text-sm border border-slate-800" style={{ background: 'var(--color-garuda-900)' }}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-mono font-bold text-slate-200">{r.imeiNumber}</p>
                  {isEdit ? (
                    <select
                      value={r.status}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className="px-2 py-1 rounded text-xs outline-none"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SWAPPED">Swapped</option>
                      <option value="SUSPICIOUS">Suspicious</option>
                      <option value="DEACTIVATED">Deactivated</option>
                    </select>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                      {r.status}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-slate-400">
                  <p>Device: {r.deviceMake || '?'} {r.deviceModel}</p>
                  <p>Mobile: {r.mobileNumber || '?'}</p>
                  <p>SIM: {r.simNumber || '?'} ({r.simProvider || '?'})</p>
                  <p>First Seen: {new Date(r.firstSeen).toLocaleDateString()}</p>
                </div>
                {r.notes && <p className="text-xs text-slate-500 mt-2 italic">{r.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Record Form */}
      {isEdit && (
        <form onSubmit={submit} className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4 mt-6">
          <h4 className="text-sm font-semibold text-slate-200">Add New IMEI Record</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required placeholder="IMEI Number (15 digits) *" className="px-3 py-2 rounded text-sm w-full font-mono" style={inputStyle} value={form.imeiNumber} onChange={(e) => setForm((f) => ({ ...f, imeiNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 15) }))} />
            <input placeholder="Mobile Number" className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.mobileNumber} onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))} />
            <input placeholder="Device Make (e.g. Samsung)" className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.deviceMake} onChange={(e) => setForm((f) => ({ ...f, deviceMake: e.target.value }))} />
            <input placeholder="Device Model (e.g. Galaxy S21)" className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.deviceModel} onChange={(e) => setForm((f) => ({ ...f, deviceModel: e.target.value }))} />
            <input placeholder="SIM Number (ICCID)" className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.simNumber} onChange={(e) => setForm((f) => ({ ...f, simNumber: e.target.value }))} />
            <input placeholder="SIM Provider (e.g. Jio)" className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.simProvider} onChange={(e) => setForm((f) => ({ ...f, simProvider: e.target.value }))} />
          </div>
          <textarea placeholder="Additional notes..." rows={2} className="px-3 py-2 rounded text-sm w-full" style={inputStyle} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <button type="submit" className="px-4 py-2 rounded text-sm text-white w-fit" style={{ background: 'var(--color-accent-500)' }}>Add Record</button>
        </form>
      )}
    </div>
  );
}
