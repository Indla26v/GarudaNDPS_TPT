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
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileUploading, setFileUploading] = useState(false);

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
      if (c.relevantFiles) {
        try {
          setUploadedFiles(JSON.parse(c.relevantFiles));
        } catch {
          setUploadedFiles(c.relevantFiles.split(',').map((url) => ({ name: url.split('/').pop(), url })));
        }
      } else {
        setUploadedFiles([]);
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
    setAccused([...accused, { offenderId: o.id, offenderName: o.fullName || o.full_name, arrestStatus: 'ARRESTED' }]);
    setOffenderSearch('');
    setOffenderResults([]);
  };

  const removeAccused = (offenderId) => setAccused(accused.filter((a) => a.offenderId !== offenderId));

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setFileUploading(true);
    setError('');
    try {
      const newUploaded = [];
      for (const file of files) {
        if (file.size > 15 * 1024 * 1024) {
          setError(`File ${file.name} is too large (max 15MB)`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post('/cases/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.data?.url) {
          newUploaded.push({
            name: res.data.data.name || file.name,
            url: res.data.data.url
          });
        }
      }
      setUploadedFiles(prev => [...prev, ...newUploaded]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload case files');
    } finally {
      setFileUploading(false);
      e.target.value = null;
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
        relevantFiles: uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : null,
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
          <div className="flex flex-wrap gap-2">
            <input
              value={offenderSearch}
              onChange={(e) => setOffenderSearch(e.target.value)}
              placeholder="Search offender by name, Aadhaar, phone, email..."
              className={`${inp} flex-1 min-w-[200px]`}
              style={fieldStyle}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchOffenders())}
            />
            <button
              type="button"
              onClick={searchOffenders}
              className="px-4 py-2 rounded-lg text-sm text-white transition-colors"
              style={{ background: 'var(--color-accent-500)', cursor: 'pointer', border: 'none' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-accent-600)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--color-accent-500)'; }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg text-sm whitespace-nowrap border"
              style={{ borderColor: 'var(--color-accent-400)', background: 'transparent', color: 'var(--color-accent-400)', cursor: 'pointer' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(234, 88, 12, 0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              + Add New Accused
            </button>
          </div>
          {offenderResults.length > 0 && (
            <ul className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-garuda-600)' }}>
              {offenderResults.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => addAccused(o)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--color-garuda-200)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-garuda-600)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {o.fullName || o.full_name} {(o.psName || o.ps_name) ? `(${o.psName || o.ps_name})` : ''}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input placeholder="Contraband (kg)" value={seizure.contrabandKg} onChange={(e) => setSeizure({ ...seizure, contrabandKg: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Cash seized (₹)" value={seizure.cashAmount} onChange={(e) => setSeizure({ ...seizure, cashAmount: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Vehicles" value={seizure.vehiclesCount} onChange={(e) => setSeizure({ ...seizure, vehiclesCount: e.target.value })} className={inp} style={fieldStyle} />
            <input placeholder="Other items" value={seizure.otherItems} onChange={(e) => setSeizure({ ...seizure, otherItems: e.target.value })} className={inp} style={fieldStyle} />
          </div>
        </div>

        <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Relevant PDF Files</h3>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label
                className="btn btn-secondary text-sm flex items-center gap-2 cursor-pointer"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
              >
                <svg className="w-4 h-4 text-accent-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {fileUploading ? 'Uploading...' : 'Choose Files'}
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={fileUploading}
                  className="hidden"
                />
              </label>
              <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                Upload scans, FIR copies, or seizure reports (PDF, Word, Images up to 15MB each).
              </span>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {uploadedFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg border text-xs"
                    style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium truncate hover:text-accent-400 transition-colors"
                        style={{ color: 'var(--color-garuda-100)' }}
                      >
                        {file.name}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-red-400 hover:text-red-500 font-bold px-2 py-1 bg-transparent border-none cursor-pointer text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
      <AddAccusedModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={addAccused}
        stations={stations}
        currentPsId={form.psId}
      />
    </div>
  );
}

function AddAccusedModal({ isOpen, onClose, onSaved, stations, currentPsId }) {
  const [modalForm, setModalForm] = useState({
    fullName: '',
    alias: '',
    fatherHusbandName: '',
    age: '',
    gender: '',
    category: '',
    psId: currentPsId || '',
    aadhaarNo: '',
    phone: '',
    fullAddress: '',
    photoUrl: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Sync station ID with current form selection when opened
  useEffect(() => {
    if (isOpen) {
      setModalForm({
        fullName: '',
        alias: '',
        fatherHusbandName: '',
        age: '',
        gender: '',
        category: '',
        psId: currentPsId || '',
        aadhaarNo: '',
        phone: '',
        fullAddress: '',
        photoUrl: ''
      });
      setError('');
    }
  }, [isOpen, currentPsId]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setModalForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Photo file size must be under 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);
    setError('');
    try {
      const res = await api.post('/offenders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.data?.url) {
        setModalForm(prev => ({ ...prev, photoUrl: res.data.data.url }));
      } else {
        setError('Upload succeeded but no URL was returned');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!modalForm.fullName.trim()) return setError('Full name is required');
    if (!modalForm.psId) return setError('Police station is required');

    setSaving(true);
    setError('');
    try {
      const payload = {
        fullName: modalForm.fullName.trim(),
        alias: modalForm.alias.trim() || null,
        fatherHusbandName: modalForm.fatherHusbandName.trim() || null,
        age: modalForm.age ? parseInt(modalForm.age, 10) : null,
        gender: modalForm.gender || null,
        category: modalForm.category || null,
        psId: parseInt(modalForm.psId, 10),
        aadhaarNo: modalForm.aadhaarNo.trim() || null,
        fullAddress: modalForm.fullAddress.trim() || null,
        photoUrl: modalForm.photoUrl || null,
        contacts: modalForm.phone.trim()
          ? [{ contactType: 'MOBILE_PRIMARY', value: modalForm.phone.trim(), notes: 'Primary' }]
          : []
      };

      const res = await api.post('/offenders', payload);
      const newId = res.data.data?.id;

      if (newId) {
        onSaved({
          id: newId,
          fullName: modalForm.fullName.trim()
        });
        onClose();
      } else {
        setError('Failed to retrieve registered offender ID.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register accused');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-default animate-fade-in" onClick={onClose} />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 border text-left shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh] z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.98), rgba(15,23,42,0.98))',
          borderColor: 'var(--color-garuda-700)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex items-center justify-between mb-4 border-b border-dashed pb-3" style={{ borderColor: 'var(--color-garuda-700)' }}>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Register & Add New Accused
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer text-lg font-bold p-1 select-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Full Name *</label>
              <input name="fullName" value={modalForm.fullName} onChange={handleChange} required className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Police Station *</label>
              <select name="psId" value={modalForm.psId} onChange={handleChange} required className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}>
                <option value="">Select PS</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.ps_code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Alias</label>
              <input name="alias" value={modalForm.alias} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Father/Husband Name</label>
              <input name="fatherHusbandName" value={modalForm.fatherHusbandName} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Age</label>
              <input type="number" name="age" value={modalForm.age} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Gender</label>
              <select name="gender" value={modalForm.gender} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Category</label>
              <select name="category" value={modalForm.category} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}>
                <option value="">Select</option>
                <option value="CONSUMER">Consumer</option>
                <option value="LOCAL_PEDDLER">Local Peddler</option>
                <option value="LOCAL_SUPPLIER">Local Supplier</option>
                <option value="LOCAL_KINGPIN">Local Kingpin</option>
                <option value="TRANSPORTER">Transporter</option>
                <option value="INTERSTATE_KINGPIN">Interstate Kingpin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Aadhaar Number</label>
              <input maxLength={12} name="aadhaarNo" value={modalForm.aadhaarNo} onChange={handleChange} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Mobile Number</label>
              <input type="tel" name="phone" value={modalForm.phone} onChange={handleChange} placeholder="Primary phone number" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Photograph</label>
              <div className="flex items-center gap-4 p-3 rounded-lg border" style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)' }}>
                {modalForm.photoUrl ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                    <img src={modalForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setModalForm(prev => ({ ...prev, photoUrl: '' }))}
                      className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] text-red-400 font-bold opacity-0 hover:opacity-100 transition-opacity cursor-pointer border-none"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-dashed border-slate-600 bg-slate-800/40 flex items-center justify-center flex-shrink-0 text-slate-500">
                    {uploading ? (
                      <span className="text-[10px] animate-pulse">...</span>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent-500/10 file:text-accent-400 hover:file:bg-accent-500/20 file:cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, or JPEG up to 5MB</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Full Address</label>
              <textarea name="fullAddress" value={modalForm.fullAddress} onChange={handleChange} rows={2} placeholder="Enter physical address details" className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }} />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-dashed" style={{ borderColor: 'var(--color-garuda-700)' }}>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)', border: 'none' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving || uploading} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer" style={{ background: 'var(--color-accent-500)', opacity: (saving || uploading) ? 0.6 : 1, border: 'none' }}>
              {saving ? 'Registering...' : 'Register & Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
