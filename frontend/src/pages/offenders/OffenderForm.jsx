import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const TABS = ['Basic Info', 'Address', 'Contacts', 'Drug Profile', 'Criminal History', 'Supply Chain'];
const CATEGORIES = ['CONSUMER','LOCAL_PEDDLER','SUPPLIER','LOCAL_KINGPIN','TRANSPORTER','INTERSTATE_KINGPIN'];
const GENDERS = ['MALE','FEMALE','OTHER'];
const PURCHASE_MODES = ['CASH','UPI','CREDIT','BARTER','OTHER'];
const CONTACT_TYPES = ['MOBILE_1','MOBILE_2','SIBLING_MOBILE','GMAIL','WHATSAPP','TELEGRAM','INSTAGRAM','FACEBOOK','UPI_ID','UPI_MOBILE','BANK_ACCOUNT','BANK_NAME','IFSC_CODE','ATM_CARD','IMEI'];
const LINK_TYPES = ['CO_CONSUMER','ASSOCIATE','PEDDLER','SUPPLIER','TRANSPORTER','KINGPIN','OTHER'];

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
  const [activeTab, setActiveTab] = useState(0);
  const [stations, setStations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    criminalHistories: [],
    supplyChainLinks: [],
  });

  useEffect(() => { fetchStations(); if (isEdit) fetchOffender(); }, []);

  const fetchStations = async () => {
    try { const r = await api.get('/ps'); setStations(r.data.data || []); } catch {}
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
        aadhaarNo: d.aadhaarNo||'', voterId: d.voterId||'', panCard: d.panCard||'',
        photoUrl: d.photoUrl||'',
        previousCrimeHistory: d.previousCrimeHistory||false, historySheetStatus: d.historySheetStatus||'',
        contacts: d.contacts||[], criminalHistories: d.criminalHistories||[], supplyChainLinks: d.supplyChainLinks||[],
      });
    } catch { setError('Failed to load offender data'); }
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
  const addContact = () => set('contacts', [...form.contacts, { contactType:'MOBILE_1', value:'', notes:'' }]);
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

  const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
  const sel = "w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            {isEdit ? 'Edit Offender' : 'Add New Offender'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>Fill in all proforma sections</p>
        </div>
        <button onClick={() => navigate('/offenders')} className="px-4 py-2 rounded-lg text-sm cursor-pointer"
          style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>← Back</button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-danger-400)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-garuda-800)' }}>
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
            <Field label="Aadhaar No"><input maxLength={12} className={inp} style={inputStyle} value={form.aadhaarNo} onChange={e => set('aadhaarNo', e.target.value)} /></Field>
            <Field label="Voter ID"><input className={inp} style={inputStyle} value={form.voterId} onChange={e => set('voterId', e.target.value)} /></Field>
            <Field label="PAN Card"><input maxLength={10} className={inp} style={inputStyle} value={form.panCard} onChange={e => set('panCard', e.target.value)} /></Field>
            <Field label="Photo URL"><input className={inp} style={inputStyle} value={form.photoUrl} onChange={e => set('photoUrl', e.target.value)} /></Field>
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

        {/* Criminal History */}
        {activeTab === 4 && (
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
        {activeTab === 5 && (
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
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
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
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all"
          style={{ background: saving ? 'var(--color-garuda-600)' : 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))', boxShadow: saving ? 'none' : 'var(--shadow-glow)' }}>
          {saving ? 'Saving...' : isEdit ? 'Update Offender' : 'Create Offender'}
        </button>
      </div>
    </div>
  );
}
