/**
 * GARUDA — Case Registration / Edit Form (Page 3) — Phase 1
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';

const CONTRABAND_OPTIONS = [
  { value: 'DRY_GANJA', label: 'Dry Ganja' },
  { value: 'GANJA_OIL', label: 'Ganja Oil' },
  { value: 'BROWN_SUGAR', label: 'Brown Sugar' },
  { value: 'HEROIN', label: 'Heroin' },
  { value: 'MDMA', label: 'MDMA' },
  { value: 'SYNTHETIC', label: 'Synthetic Drugs' },
  { value: 'COCAINE', label: 'Cocaine' },
  { value: 'OPIUM', label: 'Opium' },
  { value: 'OTHER', label: 'Others' },
];

const UNIT_OPTIONS = [
  { value: 'KG', label: 'kg' },
  { value: 'GRAMS', label: 'grams' },
  { value: 'ML', label: 'ml' },
  { value: 'TABLETS', label: 'tablets' },
  { value: 'STRIPS', label: 'strips' },
  { value: 'PACKETS', label: 'packets' },
];

const inp = "w-full px-3 py-2.5 rounded-lg text-sm outline-none";
const fieldStyle = { background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' };

export default function CaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    firNo: '',
    psId: '',
    sectionOfLaw: '',
    caseDate: new Date().toISOString().split('T')[0],
    stage: 'FIR',
    natureOfOffence: '',
    contrabandType: '',
    quantity: '',
    quantityUnit: 'KG',
    streetValue: '',
    sourceLocation: '',
    destinationLocation: '',
    intelligenceNotes: '',
    department: 'POLICE',
    isHistorySheet: false,
    isRowdySheet: false,
  });
  const [stations, setStations] = useState([]);
  const [accused, setAccused] = useState([]);
  const [offenderSearch, setOffenderSearch] = useState('');
  const [offenderResults, setOffenderResults] = useState([]);
  const [seizure, setSeizure] = useState({ contrabandKg: '', cashAmount: '', vehiclesCount: '0', otherItems: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStations();
    if (isEdit) fetchCase();
  }, [id]);

  const fetchStations = async () => {
    try {
      const res = await api.get('/police-stations');
      setStations(res.data.data || []);
    } catch { /* ignore */ }
  };

  const fetchCase = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/cases/${id}`);
      const c = res.data.data;
      setForm({
        firNo: c.firNo || '',
        psId: c.psId?.toString() || '',
        sectionOfLaw: c.sectionOfLaw || '',
        caseDate: c.caseDate ? c.caseDate.split('T')[0] : '',
        stage: c.stage || 'FIR',
        natureOfOffence: c.natureOfOffence || '',
        contrabandType: c.contrabandType || '',
        quantity: c.quantity?.toString() || '',
        quantityUnit: c.quantityUnit || 'KG',
        streetValue: c.streetValue?.toString() || '',
        sourceLocation: c.sourceLocation || '',
        destinationLocation: c.destinationLocation || '',
        intelligenceNotes: c.intelligenceNotes || '',
        department: c.department || 'POLICE',
        isHistorySheet: c.isHistorySheet || false,
        isRowdySheet: c.isRowdySheet || false,
      });
      setAccused((c.accused || []).map((a) => ({
        offenderId: a.offenderId,
        offenderName: a.offenderName,
        arrestStatus: a.arrestStatus || 'ARRESTED',
      })));
      if (c.seizures?.[0]) {
        const s = c.seizures[0];
        setSeizure({
          contrabandKg: s.contrabandKg?.toString() || '',
          cashAmount: s.cashAmount?.toString() || '',
          vehiclesCount: s.vehiclesCount?.toString() || '0',
          otherItems: s.otherItems || '',
        });
      }
    } catch {
      setError('Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const searchOffenders = async () => {
    if (!offenderSearch.trim()) return;
    try {
      const res = await api.get('/offenders', { params: { query: offenderSearch, size: 10 } });
      setOffenderResults(res.data.data?.content || []);
    } catch {
      setOffenderResults([]);
    }
  };

  const addAccused = (o) => {
    if (accused.some((a) => a.offenderId === o.id)) return;
    setAccused([...accused, { offenderId: o.id, offenderName: o.full_name, arrestStatus: 'ARRESTED' }]);
    setOffenderSearch('');
    setOffenderResults([]);
  };

  const removeAccused = (offenderId) => setAccused(accused.filter((a) => a.offenderId !== offenderId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        psId: parseInt(form.psId, 10),
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        streetValue: form.streetValue ? parseFloat(form.streetValue) : null,
        accused: accused.map((a) => ({ offenderId: a.offenderId, arrestStatus: a.arrestStatus })),
        seizures: seizure.contrabandKg || seizure.cashAmount
          ? [{
              contrabandKg: seizure.contrabandKg ? parseFloat(seizure.contrabandKg) : null,
              cashAmount: seizure.cashAmount ? parseFloat(seizure.cashAmount) : 0,
              vehiclesCount: parseInt(seizure.vehiclesCount, 10) || 0,
              otherItems: seizure.otherItems || null,
            }]
          : [],
      };
      if (isEdit) {
        await api.put(`/cases/${id}`, payload);
        if (accused.length) await api.post(`/cases/${id}/accused`, accused.map((a) => ({ offenderId: a.offenderId, arrestStatus: a.arrestStatus })));
        if (payload.seizures?.length) await api.post(`/cases/${id}/seizures`, payload.seizures);
        navigate(`/cases/${id}`);
      } else {
        const res = await api.post('/cases', payload);
        const newId = res.data.data?.id;
        navigate(newId ? `/cases/${newId}` : '/cases');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save case');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading case...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          {isEdit ? 'Edit Case' : 'Register New Case'}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          {isEdit ? 'Update case details' : 'Register a new NDPS case — FIR auto-generated if left blank'}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Case Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>FIR Number</label>
              <input name="firNo" value={form.firNo} onChange={handleChange} placeholder="Auto if empty" className={inp} style={fieldStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Station *</label>
              <select name="psId" value={form.psId} onChange={handleChange} required className={inp} style={fieldStyle}>
                <option value="">Select Station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ps_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Department</label>
              <select name="department" value={form.department} onChange={handleChange} className={inp} style={fieldStyle}>
                <option value="POLICE">Police</option>
                <option value="EXCISE">Excise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Case Date *</label>
              <input type="date" name="caseDate" value={form.caseDate} onChange={handleChange} required className={inp} style={fieldStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Section of Law</label>
              <input name="sectionOfLaw" value={form.sectionOfLaw} onChange={handleChange} className={inp} style={fieldStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Nature of Offence</label>
              <input name="natureOfOffence" value={form.natureOfOffence} onChange={handleChange} className={inp} style={fieldStyle} />
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Stage</label>
                <select name="stage" value={form.stage} onChange={handleChange} className={inp} style={fieldStyle}>
                  <option value="FIR">FIR</option>
                  <option value="CHARGESHEET">Charge Sheet</option>
                  <option value="TRIAL">Trial</option>
                  <option value="CONVICTED">Convicted</option>
                  <option value="ACQUITTED">Acquitted</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Contraband & Route</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Type</label>
              <select name="contrabandType" value={form.contrabandType} onChange={handleChange} className={inp} style={fieldStyle}>
                <option value="">—</option>
                {CONTRABAND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Quantity</label>
                <input name="quantity" type="number" step="0.001" value={form.quantity} onChange={handleChange} className={inp} style={fieldStyle} />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Unit</label>
                <select name="quantityUnit" value={form.quantityUnit} onChange={handleChange} className={inp} style={fieldStyle}>
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Street Value (₹)</label>
              <input name="streetValue" type="number" value={form.streetValue} onChange={handleChange} className={inp} style={fieldStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Source Location</label>
              <input name="sourceLocation" value={form.sourceLocation} onChange={handleChange} className={inp} style={fieldStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Destination</label>
              <input name="destinationLocation" value={form.destinationLocation} onChange={handleChange} className={inp} style={fieldStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Intelligence Notes</label>
              <textarea name="intelligenceNotes" value={form.intelligenceNotes} onChange={handleChange} rows={3} className={inp} style={fieldStyle} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isHistorySheet" checked={form.isHistorySheet} onChange={handleChange} />
              <span className="text-sm" style={{ color: 'var(--color-garuda-300)' }}>History Sheet</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isRowdySheet" checked={form.isRowdySheet} onChange={handleChange} />
              <span className="text-sm" style={{ color: 'var(--color-garuda-300)' }}>Rowdy Sheet</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Accused</h3>
          <div className="flex gap-2">
            <input
              value={offenderSearch}
              onChange={(e) => setOffenderSearch(e.target.value)}
              placeholder="Search offender by name..."
              className={`${inp} flex-1`}
              style={fieldStyle}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchOffenders())}
            />
            <button type="button" onClick={searchOffenders} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--color-garuda-600)', color: '#fff' }}>
              Search
            </button>
          </div>
          {offenderResults.length > 0 && (
            <ul className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-garuda-600)' }}>
              {offenderResults.map((o) => (
                <li key={o.id}>
                  <button type="button" onClick={() => addAccused(o)} className="w-full text-left px-3 py-2 text-sm hover:bg-garuda-700" style={{ color: 'var(--color-garuda-200)' }}>
                    {o.full_name} {o.ps_name ? `(${o.ps_name})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {accused.length > 0 && (
            <ul className="space-y-2">
              {accused.map((a) => (
                <li key={a.offenderId} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--color-garuda-900)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-garuda-100)' }}>{a.offenderName}</span>
                  <button type="button" onClick={() => removeAccused(a.offenderId)} className="text-xs text-red-400">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Seizure (optional)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Contraband (kg)" value={seizure.contrabandKg} onChange={(e) => setSeizure({ ...seizure, contrabandKg: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Cash seized (₹)" value={seizure.cashAmount} onChange={(e) => setSeizure({ ...seizure, cashAmount: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Vehicles" value={seizure.vehiclesCount} onChange={(e) => setSeizure({ ...seizure, vehiclesCount: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Other items" value={seizure.otherItems} onChange={(e) => setSeizure({ ...seizure, otherItems: e.target.value })} className={inp} style={fieldStyle} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/cases')} className="px-5 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg text-sm text-white" style={{ background: 'var(--color-accent-500)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Case' : 'Register Case'}
          </button>
        </div>
      </form>
    </div>
  );
}
