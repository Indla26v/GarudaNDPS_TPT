/**
 * Charge sheet, court hearings, and bail records for a case (Phase 1).
 */
import { useState, useEffect } from 'react';
import api from '../api/axios';

const inputStyle = {
  background: 'var(--color-garuda-900)',
  border: '1px solid var(--color-garuda-600)',
  color: 'var(--color-garuda-100)',
};

export default function CaseLifecyclePanel({ caseId, canEdit }) {
  const [chargeSheet, setChargeSheet] = useState(null);
  const [hearings, setHearings] = useState([]);
  const [bailRecords, setBailRecords] = useState([]);
  const [csForm, setCsForm] = useState({});
  const [hearingForm, setHearingForm] = useState({});
  const [bailForm, setBailForm] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadAll();
  }, [caseId]);

  const loadAll = async () => {
    try {
      const [cs, ch, br] = await Promise.all([
        api.get(`/cases/${caseId}/charge-sheet`),
        api.get(`/cases/${caseId}/court-hearings`),
        api.get(`/cases/${caseId}/bail-records`),
      ]);
      const csData = cs.data.data;
      setChargeSheet(csData);
      if (csData) {
        setCsForm({
          expectedSubmissionDate: csData.expectedSubmissionDate?.split?.('T')?.[0] || '',
          actualSubmissionDate: csData.actualSubmissionDate?.split?.('T')?.[0] || '',
          prosecutorName: csData.prosecutorName || '',
          missingDocuments: csData.missingDocuments || '',
          notes: csData.notes || '',
        });
      }
      setHearings(ch.data.data || []);
      setBailRecords(br.data.data || []);
    } catch { /* ignore */ }
  };

  const saveChargeSheet = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/cases/${caseId}/charge-sheet`, csForm);
      setMsg('Charge sheet saved');
      loadAll();
    } catch {
      setMsg('Failed to save charge sheet');
    }
  };

  const addHearing = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/cases/${caseId}/court-hearings`, hearingForm);
      setHearingForm({});
      setMsg('Hearing added');
      loadAll();
    } catch {
      setMsg('Failed to add hearing');
    }
  };

  const addBail = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/cases/${caseId}/bail-records`, bailForm);
      setBailForm({});
      setMsg('Bail record added');
      loadAll();
    } catch {
      setMsg('Failed to add bail record');
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <p className="text-sm px-3 py-2 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{msg}</p>
      )}

      <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Charge Sheet</h3>
        <form onSubmit={saveChargeSheet} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
            Expected date
            <input type="date" className="w-full mt-1 px-2 py-2 rounded text-sm" style={inputStyle}
              value={csForm.expectedSubmissionDate || ''} onChange={e => setCsForm(f => ({ ...f, expectedSubmissionDate: e.target.value }))} disabled={!canEdit} />
          </label>
          <label className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
            Actual submission
            <input type="date" className="w-full mt-1 px-2 py-2 rounded text-sm" style={inputStyle}
              value={csForm.actualSubmissionDate || ''} onChange={e => setCsForm(f => ({ ...f, actualSubmissionDate: e.target.value }))} disabled={!canEdit} />
          </label>
          <label className="text-xs md:col-span-2" style={{ color: 'var(--color-garuda-400)' }}>
            Prosecutor
            <input className="w-full mt-1 px-2 py-2 rounded text-sm" style={inputStyle}
              value={csForm.prosecutorName || ''} onChange={e => setCsForm(f => ({ ...f, prosecutorName: e.target.value }))} disabled={!canEdit} />
          </label>
          {canEdit && (
            <button type="submit" className="md:col-span-2 px-4 py-2 rounded text-sm text-white" style={{ background: 'var(--color-accent-500)' }}>
              Save Charge Sheet
            </button>
          )}
        </form>
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Court Hearings</h3>
        {hearings.length > 0 && (
          <ul className="space-y-2 mb-4">
            {hearings.map(h => (
              <li key={h.id} className="p-3 rounded text-sm" style={{ background: 'var(--color-garuda-900)' }}>
                <span style={{ color: 'var(--color-garuda-100)' }}>{h.courtName || 'Court'} — SC {h.scNumber || '—'}</span>
                <span className="block text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                  {h.hearingDate ? new Date(h.hearingDate).toLocaleDateString('en-IN') : '—'}
                  {h.nextHearingDate ? ` → Next: ${new Date(h.nextHearingDate).toLocaleDateString('en-IN')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={addHearing} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="SC Number" className="px-2 py-2.5 rounded text-sm" style={inputStyle} value={hearingForm.scNumber || ''} onChange={e => setHearingForm(f => ({ ...f, scNumber: e.target.value }))} />
            <input placeholder="Court name" className="px-2 py-2.5 rounded text-sm" style={inputStyle} value={hearingForm.courtName || ''} onChange={e => setHearingForm(f => ({ ...f, courtName: e.target.value }))} />
            <input type="date" className="px-2 py-2.5 rounded text-sm" style={inputStyle} value={hearingForm.hearingDate || ''} onChange={e => setHearingForm(f => ({ ...f, hearingDate: e.target.value }))} />
            <input type="date" className="px-2 py-2.5 rounded text-sm" style={inputStyle} value={hearingForm.nextHearingDate || ''} onChange={e => setHearingForm(f => ({ ...f, nextHearingDate: e.target.value }))} />
            <button type="submit" className="col-span-1 sm:col-span-2 px-4 py-2.5 rounded text-sm text-white font-semibold cursor-pointer" style={{ background: 'var(--color-accent-500)' }}>Add Hearing</button>
          </form>
        )}
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Bail Records</h3>
        {bailRecords.length > 0 && (
          <ul className="space-y-2 mb-4">
            {bailRecords.map(b => (
              <li key={b.id} className="p-3 rounded text-sm" style={{ background: 'var(--color-garuda-900)' }}>
                <span style={{ color: 'var(--color-garuda-100)' }}>{b.status}</span>
                <span className="block text-xs" style={{ color: 'var(--color-garuda-400)' }}>{b.courtName || '—'}</span>
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form onSubmit={addBail} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="px-2 py-2.5 rounded text-sm cursor-pointer" style={inputStyle} value={bailForm.status || 'PENDING'} onChange={e => setBailForm(f => ({ ...f, status: e.target.value }))}>
              <option value="PENDING">Pending</option>
              <option value="GRANTED">Granted</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input placeholder="Court" className="px-2 py-2.5 rounded text-sm" style={inputStyle} value={bailForm.courtName || ''} onChange={e => setBailForm(f => ({ ...f, courtName: e.target.value }))} />
            <button type="submit" className="col-span-1 sm:col-span-2 px-4 py-2.5 rounded text-sm text-white font-semibold cursor-pointer" style={{ background: 'var(--color-accent-500)' }}>Add Bail Record</button>
          </form>
        )}
      </div>
    </div>
  );
}
