import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';
import { OffenderCaseHistory, OffenderInterrogationPanel } from '../../components/OffenderPhase1Panels';

const BASE_TABS = ['Basic Info', 'Address', 'Contacts', 'Drug Profile', 'Financials', 'Criminal History', 'Supply Chain'];
const EDIT_EXTRA_TABS = ['Case History', 'Interrogation'];
const CATEGORIES = ['CONSUMER','LOCAL_PEDDLER','LOCAL_SUPPLIER','LOCAL_KINGPIN','TRANSPORTER','INTERSTATE_KINGPIN'];
const GENDERS = ['MALE','FEMALE','OTHER'];
const PURCHASE_MODES = ['CASH','UPI','CREDIT','BARTER','OTHER'];
const CONTACT_TYPES = ['MOBILE_PRIMARY','MOBILE_SECONDARY','MOBILE_SIBLING','GMAIL','WHATSAPP','TELEGRAM','INSTAGRAM','FACEBOOK','OTHER_SOCIAL'];
const LINK_TYPES = ['CO_CONSUMER','PEDDLER','SUPPLIER','TRANSPORTER','KINGPIN'];
const FIN_TYPES = [
  { value: 'BANK_ACCOUNT_NO', label: 'Bank Account No' },
  { value: 'BANK_NAME', label: 'Bank Name' },
  { value: 'IFSC_CODE', label: 'IFSC Code' },
  { value: 'UPI_ID', label: 'UPI ID' },
  { value: 'UPI_LINKED_MOBILE', label: 'UPI Linked Mobile' },
  { value: 'ATM_CARD', label: 'ATM Card No' },
];

const inputStyle = {
  background: 'var(--color-garuda-700)',
  border: '1px solid var(--color-garuda-600)',
  color: 'var(--color-garuda-50)',
};
const labelStyle = { color: 'var(--color-garuda-300)' };

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function OffenderForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState(0);
  const [aadhaarRevealed, setAadhaarRevealed] = useState(false);
  const [aadhaarMasked, setAadhaarMasked] = useState(true);
  const [stations, setStations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [form, setForm] = useState({
    slNo:'', psId:'', fullName:'', alias:'', fatherHusbandName:'',
    age:'', gender:'', category:'',
    fullAddress:'', landmark:'', district:'', state:'',
    occupation:'', monthlyIncome:'',
    addictionType:'', consumptionFrequency:'', sourceOfProcurement:'',
    testResult:'', modeOfPurchase:'', usualConsumptionSpot:'',
    aadhaarNo:'', voterId:'', panCard:'', photoUrl:'',
    previousCrimeHistory: false, historySheetStatus:'',
    contacts: [],
    financials: [],
    criminalHistories: [],
    supplyChainLinks: [],
  });

  useEffect(() => { fetchStations(); if (isEdit) fetchOffender(); }, []);

  const fetchStations = async () => {
    try { const r = await api.get('/police-stations'); setStations(r.data.data || []); } catch {}
  };

  const fetchOffender = async () => {
    try {
      const r = await api.get(`/offenders/${id}`);
      const d = r.data.data;
      setForm({
        slNo: d.slNo||'', psId: d.psId||'', fullName: d.fullName||'',
        alias: d.alias||'', fatherHusbandName: d.fatherHusbandName||'',
        age: d.age||'', gender: d.gender||'', category: d.category||'',
        fullAddress: d.fullAddress||'', landmark: d.landmark||'',
        district: d.district||'', state: d.state||'',
        occupation: d.occupation||'', monthlyIncome: d.monthlyIncome||'',
        addictionType: d.addictionType||'', consumptionFrequency: d.consumptionFrequency||'',
        sourceOfProcurement: d.sourceOfProcurement||'', testResult: d.testResult||'',
        modeOfPurchase: d.modeOfPurchase||'', usualConsumptionSpot: d.usualConsumptionSpot||'',
        aadhaarNo: d.identityDocs?.aadhaarNo || d.aadhaarNo || '',
        voterId: d.identityDocs?.voterId || d.voterId || '',
        panCard: d.identityDocs?.panCard || d.panCard || '',
        photoUrl: d.photoUrl||'',
        previousCrimeHistory: d.previousCrimeHistory||false, historySheetStatus: d.historySheetStatus||'',
        contacts: d.contacts||[],
        financials: (d.financials||[]).map(f => ({ finType: f.finType, value: f.value, bankName: f.bankName||'', notes: f.notes||'' })),
        criminalHistories: d.criminalHistories||[], supplyChainLinks: d.supplyChainLinks||[],
      });
      setAadhaarMasked(d.identityDocs?.aadhaarMasked ?? !!String(d.aadhaarNo || '').includes('XXXX'));
    } catch { setError('Failed to load offender data'); }
  };

  const revealAadhaar = async () => {
    try {
      const r = await api.get(`/offenders/${id}`, { params: { reveal: 'true' } });
      const a = r.data.data?.identityDocs?.aadhaarNo || r.data.data?.aadhaarNo;
      set('aadhaarNo', a || '');
      setAadhaarRevealed(true);
      setAadhaarMasked(false);
    } catch {
      setError('Not authorized to view Aadhaar');
    }
  };

  const printHistorySheet = async () => {
    try {
      const r = await api.get(`/offenders/${id}/history-sheet`);
      const d = r.data;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<html><head><title>History Sheet - ${d.offender.fullName}</title></head><body style="font-family:sans-serif;padding:24px">`);
      w.document.write(`<h1>NDPS History Sheet</h1><p><strong>${d.offender.fullName}</strong> — ${d.offender.psName || ''}</p>`);
      w.document.write(`<p>Father: ${d.offender.fatherHusbandName || '—'} | Age: ${d.offender.age || '—'}</p>`);
      w.document.write('<h2>Case Timeline</h2><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th>FIR</th><th>PS</th><th>Date</th><th>Stage</th></tr>');
      (d.timeline || []).forEach((c) => {
        w.document.write(`<tr><td>${c.firNo}</td><td>${c.psName || ''}</td><td>${c.caseDate ? new Date(c.caseDate).toLocaleDateString('en-IN') : ''}</td><td>${c.stage}</td></tr>`);
      });
      w.document.write('</table></body></html>');
      w.document.close();
      w.print();
    } catch {
      setError('Failed to generate history sheet');
    }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { setError('Full name is required'); return; }
    if (!form.psId) { setError('Police station is required'); return; }
    setSaving(true); setError('');
    try {
      const body = { ...form, age: form.age ? Number(form.age) : null,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : null,
        psId: Number(form.psId) };
      if (isEdit) { await api.put(`/offenders/${id}`, body); }
      else { await api.post('/offenders', body); }
      navigate('/offenders');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // Contact helpers
  const addContact = () => set('contacts', [...form.contacts, { contactType:'MOBILE_PRIMARY', value:'', notes:'' }]);
  const removeContact = (i) => set('contacts', form.contacts.filter((_, j) => j !== i));
  const updateContact = (i, key, val) => {
    const c = [...form.contacts]; c[i] = { ...c[i], [key]: val }; set('contacts', c);
  };

  // Criminal history helpers
  const addCrimHistory = () => set('criminalHistories', [...form.criminalHistories, { previousCrNo:'', previousPs:'', sectionsOfLaw:'', caseStage:'', notes:'' }]);
  const removeCrimHistory = (i) => set('criminalHistories', form.criminalHistories.filter((_, j) => j !== i));
  const updateCrimHistory = (i, key, val) => {
    const c = [...form.criminalHistories]; c[i] = { ...c[i], [key]: val }; set('criminalHistories', c);
  };

  // Supply chain helpers
  const addLink = () => set('supplyChainLinks', [...form.supplyChainLinks, { linkType:'CO_CONSUMER', linkedName:'', linkedContact:'', notes:'', linkedOffenderId:null }]);
  const removeLink = (i) => set('supplyChainLinks', form.supplyChainLinks.filter((_, j) => j !== i));
  const updateLink = (i, key, val) => {
    const c = [...form.supplyChainLinks]; c[i] = { ...c[i], [key]: val }; set('supplyChainLinks', c);
  };

  // Financial helpers
  const addFinancial = () => set('financials', [...form.financials, { finType:'BANK_ACCOUNT_NO', value:'', bankName:'', notes:'' }]);
  const removeFinancial = (i) => set('financials', form.financials.filter((_, j) => j !== i));
  const updateFinancial = (i, key, val) => {
    const c = [...form.financials]; c[i] = { ...c[i], [key]: val }; set('financials', c);
  };

  // Photo upload handlers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch (err) {
      setError('Could not access camera. Please use file upload instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob(async (blob) => {
      stopCamera();
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadFile(file);
      }
    }, 'image/jpeg', 0.85);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    setUploadingPhoto(true);
    setError('');
    try {
      const res = await api.post('/offenders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.data?.url) {
        set('photoUrl', res.data.data.url);
      } else {
        setError('Upload succeeded but no URL was returned');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const sel = "w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer";
  const TABS = isEdit ? [...BASE_TABS, ...EDIT_EXTRA_TABS] : BASE_TABS;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            {isEdit ? 'Edit Offender' : 'Add New Offender'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>Fill in all proforma sections</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEdit && (
            <button type="button" onClick={printHistorySheet} className="px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
              style={{ background: 'var(--color-garuda-600)', color: '#fff' }}>Print History Sheet</button>
          )}
          <button onClick={() => navigate('/offenders')} className="px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>← Back</button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger-400)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: 'var(--color-garuda-800)' }}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === i ? 'text-white' : ''}`}
            style={{ background: activeTab === i ? 'var(--color-garuda-600)' : 'transparent', color: activeTab === i ? 'white' : 'var(--color-garuda-400)' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        {/* Basic Info */}
        {activeTab === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Serial No"><input className={inp} style={inputStyle} value={form.slNo} onChange={e => set('slNo', e.target.value)} /></Field>
            <Field label="Police Station *">
              <select className={sel} style={inputStyle} value={form.psId} onChange={e => set('psId', e.target.value)}>
                <option value="">Select PS</option>
                {stations.map(ps => <option key={ps.id} value={ps.id}>{ps.name}</option>)}
              </select>
            </Field>
            <Field label="Full Name *"><input className={inp} style={inputStyle} value={form.fullName} onChange={e => set('fullName', e.target.value)} /></Field>
            <Field label="Alias"><input className={inp} style={inputStyle} value={form.alias} onChange={e => set('alias', e.target.value)} /></Field>
            <Field label="Father/Husband Name"><input className={inp} style={inputStyle} value={form.fatherHusbandName} onChange={e => set('fatherHusbandName', e.target.value)} /></Field>
            <Field label="Age"><input type="number" className={inp} style={inputStyle} value={form.age} onChange={e => set('age', e.target.value)} /></Field>
            <Field label="Gender">
              <select className={sel} style={inputStyle} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select</option>{GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className={sel} style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Select</option>{CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Occupation"><input className={inp} style={inputStyle} value={form.occupation} onChange={e => set('occupation', e.target.value)} /></Field>
            <Field label="Monthly Income (₹)"><input type="number" className={inp} style={inputStyle} value={form.monthlyIncome} onChange={e => set('monthlyIncome', e.target.value)} /></Field>
            <Field label="Aadhaar No">
              <div className="flex gap-2">
                <input maxLength={12} className={`${inp} flex-1`} style={inputStyle} value={form.aadhaarNo} onChange={e => set('aadhaarNo', e.target.value)} readOnly={aadhaarMasked && !aadhaarRevealed} />
                {isEdit && aadhaarMasked && perms.hasMinRole('CI') && (
                  <button type="button" onClick={revealAadhaar} className="px-3 py-2 rounded text-xs whitespace-nowrap" style={{ background: 'var(--color-garuda-600)', color: '#fff' }}>
                    Reveal
                  </button>
                )}
              </div>
            </Field>
            <Field label="Voter ID"><input className={inp} style={inputStyle} value={form.voterId} onChange={e => set('voterId', e.target.value)} /></Field>
            <Field label="PAN Card"><input maxLength={10} className={inp} style={inputStyle} value={form.panCard} onChange={e => set('panCard', e.target.value)} /></Field>
            {/* Photo Upload */}
            <div className="md:col-span-2">
              <Field label="Subject Photograph">
                <div className="flex flex-col gap-3 p-4 rounded-xl border" style={{ background: 'var(--color-garuda-700)', borderColor: 'var(--color-garuda-600)' }}>
                  {form.photoUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                        <img src={form.photoUrl} alt="Subject Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => set('photoUrl', '')}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-red-400 font-bold opacity-0 hover:opacity-100 transition-opacity cursor-pointer border-none"
                        >
                          Remove
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-400">✓ Photograph Uploaded</p>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-garuda-400)' }}>Click image to remove</p>
                      </div>
                    </div>
                  ) : cameraActive ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden border border-slate-700 bg-black">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                            <span className="text-xs text-slate-300 animate-pulse">Uploading…</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 w-full max-w-sm">
                        <button type="button" onClick={capturePhoto} disabled={uploadingPhoto}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold border-none cursor-pointer flex items-center justify-center gap-1.5">
                          📸 Capture
                        </button>
                        <button type="button" onClick={stopCamera} disabled={uploadingPhoto}
                          className="px-4 py-2 rounded-lg text-xs font-semibold border-none cursor-pointer" style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <button type="button" onClick={startCamera} disabled={uploadingPhoto}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-all border"
                        style={{ background: 'rgba(233,115,25,0.1)', color: '#e97319', borderColor: 'rgba(233,115,25,0.3)' }}>
                        📷 Use Live Camera
                      </button>
                      <div className="text-xs font-medium" style={{ color: 'var(--color-garuda-500)' }}>or</div>
                      <div className="flex-1 w-full">
                        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} disabled={uploadingPhoto}
                          className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
                          style={{ color: 'var(--color-garuda-400)' }} />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--color-garuda-500)' }}>Choose image or use mobile camera</p>
                      </div>
                      {uploadingPhoto && <span className="text-xs animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Uploading…</span>}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>
        )}

        {/* Address */}
        {activeTab === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Field label="Full Address"><textarea rows={3} className={inp} style={inputStyle} value={form.fullAddress} onChange={e => set('fullAddress', e.target.value)} /></Field></div>
            <Field label="Landmark"><input className={inp} style={inputStyle} value={form.landmark} onChange={e => set('landmark', e.target.value)} /></Field>
            <Field label="District"><input className={inp} style={inputStyle} value={form.district} onChange={e => set('district', e.target.value)} /></Field>
            <Field label="State"><input className={inp} style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} /></Field>
          </div>
        )}

        {/* Contacts */}
        {activeTab === 2 && (
          <div className="space-y-4">
            {form.contacts.map((c, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-lg" style={{ background: 'var(--color-garuda-700)' }}>
                <select className="px-2 py-2 rounded text-xs" style={inputStyle} value={c.contactType} onChange={e => updateContact(i, 'contactType', e.target.value)}>
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <input className="flex-1 px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Value" value={c.value} onChange={e => updateContact(i, 'value', e.target.value)} />
                <input className="w-40 px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Notes" value={c.notes||''} onChange={e => updateContact(i, 'notes', e.target.value)} />
                <button onClick={() => removeContact(i)} className="px-2 py-2 rounded text-xs text-red-400 cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)' }}>✕</button>
              </div>
            ))}
            <button onClick={addContact} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}>+ Add Contact</button>
          </div>
        )}

        {/* Drug Profile */}
        {activeTab === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Addiction Type"><input className={inp} style={inputStyle} value={form.addictionType} onChange={e => set('addictionType', e.target.value)} placeholder="e.g. Ganja, Brown Sugar" /></Field>
            <Field label="Consumption Frequency"><input className={inp} style={inputStyle} value={form.consumptionFrequency} onChange={e => set('consumptionFrequency', e.target.value)} placeholder="e.g. Daily, Weekly" /></Field>
            <Field label="Source of Procurement"><input className={inp} style={inputStyle} value={form.sourceOfProcurement} onChange={e => set('sourceOfProcurement', e.target.value)} /></Field>
            <Field label="Test Result"><input className={inp} style={inputStyle} value={form.testResult} onChange={e => set('testResult', e.target.value)} placeholder="e.g. Positive, Negative" /></Field>
            <Field label="Mode of Purchase">
              <select className={sel} style={inputStyle} value={form.modeOfPurchase} onChange={e => set('modeOfPurchase', e.target.value)}>
                <option value="">Select</option>{PURCHASE_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Usual Consumption Spot"><input className={inp} style={inputStyle} value={form.usualConsumptionSpot} onChange={e => set('usualConsumptionSpot', e.target.value)} /></Field>
          </div>
        )}

        {/* Financials */}
        {activeTab === 4 && (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Bank accounts, UPI IDs, IFSC codes, and other financial details linked to this person.</p>
            {form.financials.map((fin, i) => (
              <div key={i} className="p-4 rounded-lg space-y-3" style={{ background: 'var(--color-garuda-700)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Entry #{i + 1}</span>
                  <button onClick={() => removeFinancial(i)} className="px-2 py-1 rounded text-xs text-red-400 cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)' }}>✕ Remove</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Type">
                    <select className={sel} style={inputStyle} value={fin.finType} onChange={e => updateFinancial(i, 'finType', e.target.value)}>
                      {FIN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Value">
                    <input className={inp} style={inputStyle} placeholder={fin.finType === 'UPI_ID' ? 'e.g. name@upi' : fin.finType === 'IFSC_CODE' ? 'e.g. SBIN0001234' : 'Enter value'} value={fin.value} onChange={e => updateFinancial(i, 'value', e.target.value)} />
                  </Field>
                  <Field label="Bank Name">
                    <input className={inp} style={inputStyle} placeholder="e.g. State Bank of India" value={fin.bankName} onChange={e => updateFinancial(i, 'bankName', e.target.value)} />
                  </Field>
                  <Field label="Notes">
                    <input className={inp} style={inputStyle} placeholder="Optional notes" value={fin.notes} onChange={e => updateFinancial(i, 'notes', e.target.value)} />
                  </Field>
                </div>
              </div>
            ))}
            <button onClick={addFinancial} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}>+ Add Financial Detail</button>
          </div>
        )}

        {/* Criminal History */}
        {activeTab === 5 && (
          <div className="space-y-4">
            <div className="flex gap-4 items-center mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={labelStyle}>
                <input type="checkbox" checked={form.previousCrimeHistory} onChange={e => set('previousCrimeHistory', e.target.checked)} />
                Previous crime history exists
              </label>
              <Field label="History Sheet Status"><input className={inp + ' w-48'} style={inputStyle} value={form.historySheetStatus} onChange={e => set('historySheetStatus', e.target.value)} /></Field>
            </div>
            {form.criminalHistories.map((ch, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg" style={{ background: 'var(--color-garuda-700)' }}>
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="CR No" value={ch.previousCrNo} onChange={e => updateCrimHistory(i, 'previousCrNo', e.target.value)} />
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Previous PS" value={ch.previousPs} onChange={e => updateCrimHistory(i, 'previousPs', e.target.value)} />
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Sections of Law" value={ch.sectionsOfLaw} onChange={e => updateCrimHistory(i, 'sectionsOfLaw', e.target.value)} />
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Case Stage" value={ch.caseStage} onChange={e => updateCrimHistory(i, 'caseStage', e.target.value)} />
                <button onClick={() => removeCrimHistory(i)} className="px-2 py-2 rounded text-xs text-red-400 cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)' }}>✕</button>
              </div>
            ))}
            <button onClick={addCrimHistory} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}>+ Add Record</button>
          </div>
        )}

        {/* Supply Chain */}
        {activeTab === 6 && (
          <div className="space-y-4">
            {form.supplyChainLinks.map((lk, i) => (
              <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg" style={{ background: 'var(--color-garuda-700)' }}>
                <select className="px-2 py-2 rounded text-xs" style={inputStyle} value={lk.linkType} onChange={e => updateLink(i, 'linkType', e.target.value)}>
                  {LINK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Name" value={lk.linkedName||''} onChange={e => updateLink(i, 'linkedName', e.target.value)} />
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Contact" value={lk.linkedContact||''} onChange={e => updateLink(i, 'linkedContact', e.target.value)} />
                <input className="px-3 py-2 rounded text-sm" style={inputStyle} placeholder="Notes" value={lk.notes||''} onChange={e => updateLink(i, 'notes', e.target.value)} />
                <button onClick={() => removeLink(i)} className="px-2 py-2 rounded text-xs text-red-400 cursor-pointer" style={{ background: 'rgba(239,68,68,0.15)' }}>✕</button>
              </div>
            ))}
            <button onClick={addLink} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}>+ Add Link</button>
          </div>
        )}

        {isEdit && activeTab === 7 && (
          <OffenderCaseHistory offenderId={id} />
        )}

        {isEdit && activeTab === 8 && (
          <OffenderInterrogationPanel offenderId={id} />
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {activeTab > 0 && (
            <button onClick={() => setActiveTab(activeTab - 1)} className="px-4 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>← Previous</button>
          )}
          {activeTab < TABS.length - 1 && (
            <button onClick={() => setActiveTab(activeTab + 1)} className="px-4 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>Next →</button>
          )}
        </div>
        <button onClick={handleSubmit} disabled={saving}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all whitespace-nowrap"
          style={{ background: saving ? 'var(--color-garuda-600)' : 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))', boxShadow: saving ? 'none' : 'var(--shadow-glow)' }}>
          {saving ? 'Saving...' : isEdit ? 'Update Offender' : 'Create Offender'}
        </button>
      </div>
    </div>
  );
}
