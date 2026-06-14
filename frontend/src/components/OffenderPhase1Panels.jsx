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
