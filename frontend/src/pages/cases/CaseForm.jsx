/**
 * GARUDA — Case Registration / Edit Form (Page 3)
 * Route: /cases/new, /cases/:id/edit
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';

const CONTRABAND_TYPES = [
  'Dry Ganja', 'Ganja Oil', 'Brown Sugar', 'Heroin', 'MDMA',
  'Synthetic Drugs', 'Cocaine', 'Opium', 'Others'
];

const UNITS = ['kg', 'grams', 'ml', 'tablets', 'strips', 'packets'];

export default function CaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const perms = usePermissions();
  const isEdit = !!id;

  const [form, setForm] = useState({
    fir_no: '',
    ps_id: '',
    section_of_law: '',
    case_date: new Date().toISOString().split('T')[0],
    stage: 'FIR',
    is_history_sheet: false,
    is_rowdy_sheet: false,
  });
  const [stations, setStations] = useState([]);
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
        fir_no: c.fir_no || '',
        ps_id: c.ps_id?.toString() || '',
        section_of_law: c.section_of_law || '',
        case_date: c.case_date ? c.case_date.split('T')[0] : '',
        stage: c.stage || 'FIR',
        is_history_sheet: c.is_history_sheet || false,
        is_rowdy_sheet: c.is_rowdy_sheet || false,
      });
    } catch {
      setError('Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, ps_id: parseInt(form.ps_id) };
      if (isEdit) {
        await api.put(`/cases/${id}`, payload);
      } else {
        await api.post('/cases', payload);
      }
      navigate('/cases');
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
          {isEdit ? 'Update case details' : 'Register a new NDPS case'}
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
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>FIR Number *</label>
              <input
                name="fir_no"
                value={form.fir_no}
                onChange={handleChange}
                required
                placeholder="e.g. 123/2026"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Police Station *</label>
              <select
                name="ps_id"
                value={form.ps_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
              >
                <option value="">Select Station</option>
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ps_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Section of Law</label>
              <input
                name="section_of_law"
                value={form.section_of_law}
                onChange={handleChange}
                placeholder="e.g. 8(c) r/w 20(b)(ii)(C)"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Case Date *</label>
              <input
                type="date"
                name="case_date"
                value={form.case_date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
              />
            </div>

            {isEdit && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>Stage</label>
                <select
                  name="stage"
                  value={form.stage}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                >
                  <option value="FIR">FIR Registered</option>
                  <option value="CHARGESHEET">Charge Sheet Filed</option>
                  <option value="TRIAL">Under Trial</option>
                  <option value="CONVICTED">Convicted</option>
                  <option value="ACQUITTED">Acquitted</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_history_sheet" checked={form.is_history_sheet} onChange={handleChange} className="accent-blue-500" />
              <span className="text-sm" style={{ color: 'var(--color-garuda-300)' }}>History Sheet</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_rowdy_sheet" checked={form.is_rowdy_sheet} onChange={handleChange} className="accent-blue-500" />
              <span className="text-sm" style={{ color: 'var(--color-garuda-300)' }}>Rowdy Sheet</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate('/cases')}
            className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : (isEdit ? 'Update Case' : 'Register Case')}
          </button>
        </div>
      </form>
    </div>
  );
}
