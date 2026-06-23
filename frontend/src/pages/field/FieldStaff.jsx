/**
 * GARUDA — Field Staff Hub (Page 4)
 * Route: /mobile
 * Responsive operational UI for field operations: Quick Case logging, Geolocation tagging,
 * Accused Dossier Verification, GPS Surveillance reporting, secure Informer management,
 * and Checkpoint / Nakabandhi logging.
 */
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../api/axios';
import VehicleCheckForm from '../../components/enforcement/forms/VehicleCheckForm';
import {
  IconEdit, IconSearch, IconSurveillance, IconLock, IconShield,
  IconWarning, IconRunning, IconClipboard, IconPackage, IconScale,
} from '../../components/Icons';

const TABS = [
  { id: 'quick-entry', label: 'Quick Case Entry', Icon: IconEdit, color: '#3b82f6', perm: 'FIELD_ENTRY' },
  { id: 'verify', label: 'Accused Verification', Icon: IconSearch, color: '#059669', perm: 'FIELD_ENTRY' },
  { id: 'surveillance', label: 'Surveillance Report', Icon: IconSurveillance, color: '#7c3aed', perm: 'FIELD_ENTRY' },
  { id: 'informer', label: 'Informer Mgmt', Icon: IconLock, color: '#d97706', perm: 'INFORMER_VIEW' },
  { id: 'checkpoint', label: 'Checkpoint Log', Icon: IconShield, color: '#ef4444', perm: 'FIELD_ENTRY' },
];

export default function FieldStaff() {
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState('quick-entry');

  // Filter tabs by permission
  const visibleTabs = TABS.filter(tab => {
    if (tab.perm) return perms.hasPermission(tab.perm);
    return true;
  });

  // Keep track of active tab obj
  const activeTabObj = TABS.find(t => t.id === activeTab);

  // Global Geolocation state
  const [gps, setGps] = useState({ lat: null, lng: null, error: null, loading: false });

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGps(prev => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }
    setGps(prev => ({ ...prev, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          loading: false,
          error: null
        });
      },
      (error) => {
        let msg = 'GPS positioning failed';
        if (error.code === 1) msg = 'Location access denied';
        else if (error.code === 2) msg = 'GPS signal lost';
        else if (error.code === 3) msg = 'Position capture timeout';
        setGps({ lat: null, lng: null, loading: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    captureGps();
  }, []);

  // Web Speech API Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceTyping = (onTranscript) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-IN'; // defaults to Indian English

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      onTranscript(text);
    };
    rec.onerror = (err) => {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  const stopVoiceTyping = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // -------------------------------------------------------------
  // TAB 1: QUICK CASE ENTRY STATE & HANDLERS
  // -------------------------------------------------------------
  const [quickForm, setQuickForm] = useState({
    firNo: '',
    psId: perms.policeStationId || '',
    sectionOfLaw: '',
    contrabandType: 'DRY_GANJA',
    quantity: '',
    quantityUnit: 'KG',
    streetValue: '',
    sourceLocation: '',
    destinationLocation: '',
    intelligenceNotes: '',
    relevantFiles: '',
  });
  const [stations, setStations] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'quick-entry' || activeTab === 'informer') {
      api.get('/police-stations')
        .then(res => setStations(res.data.data || []))
        .catch(err => console.error('Failed to load stations', err));
    }
  }, [activeTab]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);
    setUploadingPhoto(true);

    try {
      const res = await api.post('/cases/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setQuickForm(prev => ({ ...prev, relevantFiles: res.data.data.url }));
        alert('Photo attached successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload photo file');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    setQuickSubmitting(true);
    try {
      const payload = {
        ...quickForm,
        psId: quickForm.psId ? String(quickForm.psId) : null,
        quantity: quickForm.quantity ? parseFloat(quickForm.quantity) : null,
        streetValue: quickForm.streetValue ? parseFloat(quickForm.streetValue) : null,
        seizures: quickForm.quantity ? [{
          contrabandKg: quickForm.quantityUnit === 'KG' ? parseFloat(quickForm.quantity) : (parseFloat(quickForm.quantity) / 1000),
          seizureDate: new Date().toISOString().split('T')[0],
        }] : [],
      };

      await api.post('/cases', payload);
      alert('Quick Case logged successfully!');
      setQuickForm({
        firNo: '',
        psId: perms.policeStationId || '',
        sectionOfLaw: '',
        contrabandType: 'DRY_GANJA',
        quantity: '',
        quantityUnit: 'KG',
        streetValue: '',
        sourceLocation: '',
        destinationLocation: '',
        intelligenceNotes: '',
        relevantFiles: '',
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit quick case log');
    } finally {
      setQuickSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: ACCUSED VERIFICATION STATE & HANDLERS
  // -------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOffender, setSelectedOffender] = useState(null);
  const [offenderTimeline, setOffenderTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [aadhaarRevealed, setAadhaarRevealed] = useState(false);
  const [revealedAadhaarVal, setRevealedAadhaarVal] = useState('');

  const handleVerifySearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const res = await api.get(`/offenders?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const openDossier = async (offender) => {
    setSelectedOffender(offender);
    setTimelineLoading(true);
    setAadhaarRevealed(false);
    setRevealedAadhaarVal('');
    try {
      // Get offender detail timeline cases
      const detailRes = await api.get(`/offenders/${offender.id}`);
      const detailedData = detailRes.data.data;
      setSelectedOffender(detailedData);

      const res = await api.get(`/cases/offender/${offender.id}`);
      setOffenderTimeline(res.data.data || []);
    } catch (err) {
      console.error('Failed to load dossier timeline', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleRevealAadhaar = async () => {
    if (!selectedOffender) return;
    try {
      const res = await api.get(`/offenders/${selectedOffender.id}?reveal=true`);
      const val = res.data.data?.identityDocs?.aadhaarNo || res.data.data?.aadhaarNo;
      setRevealedAadhaarVal(val);
      setAadhaarRevealed(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Access Denied: You do not have permission to reveal Aadhaar numbers');
    }
  };

  // -------------------------------------------------------------
  // TAB 3: GPS-TAGGED SURVEILLANCE STATE & HANDLERS
  // -------------------------------------------------------------
  const [survForm, setSurvForm] = useState({
    offenderId: '',
    status: 'PENDING',
    currentAddress: '',
    currentOccupation: '',
    associatesNoted: '',
    notes: '',
  });
  const [offendersList, setOffendersList] = useState([]);
  const [survSubmitting, setSurvSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'surveillance') {
      api.get('/offenders?size=100')
        .then(res => setOffendersList(res.data.data?.content || []))
        .catch(err => console.error(err));
    }
  }, [activeTab]);

  const handleSurvSubmit = async (e) => {
    e.preventDefault();
    if (!survForm.offenderId) {
      alert('Please select an accused offender');
      return;
    }
    setSurvSubmitting(true);
    try {
      const payload = {
        ...survForm,
        scheduledDate: new Date().toISOString().split('T')[0],
        geo_lat: gps.lat,
        geo_lng: gps.lng,
      };
      await api.post('/surveillance', payload);
      alert('Surveillance check-in logged successfully!');
      setSurvForm({
        offenderId: '',
        status: 'PENDING',
        currentAddress: '',
        currentOccupation: '',
        associatesNoted: '',
        notes: '',
      });
    } catch (err) {
      console.error(err);
      alert('Failed to submit surveillance log');
    } finally {
      setSurvSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 4: INFORMER MANAGEMENT STATE & HANDLERS
  // -------------------------------------------------------------
  const [informers, setInformers] = useState([]);
  const [infLoading, setInfLoading] = useState(false);
  const [informerSubTab, setInformerSubTab] = useState('list');
  const [regForm, setRegForm] = useState({ codeName: '', phone: '', rating: 'C' });
  const [tipForm, setTipForm] = useState({ informerId: '', offenderId: '', psId: perms.policeStationId || '', inputText: '', supplyRoute: '' });
  const [regSaving, setRegSaving] = useState(false);
  const [tipSaving, setTipSaving] = useState(false);

  const fetchInformers = async () => {
    setInfLoading(true);
    try {
      const res = await api.get('/informers');
      setInformers(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setInfLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'informer') {
      fetchInformers();
      api.get('/offenders?size=100')
        .then(res => setOffendersList(res.data.data?.content || []))
        .catch(err => console.error(err));
    }
  }, [activeTab]);

  const handleRegisterInformer = async (e) => {
    e.preventDefault();
    if (!regForm.codeName) return;
    setRegSaving(true);
    try {
      await api.post('/informers', regForm);
      alert('Informer registered successfully!');
      setRegForm({ codeName: '', phone: '', rating: 'C' });
      setInformerSubTab('list');
      await fetchInformers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register informer');
    } finally {
      setRegSaving(false);
    }
  };

  const handleToggleInformerStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to set this informer to ${nextStatus}?`)) return;
    try {
      await api.put(`/informers/${id}`, { status: nextStatus });
      alert('Informer status updated');
      await fetchInformers();
    } catch (err) {
      alert('Failed to update informer status');
    }
  };

  const handleTipSubmit = async (e) => {
    e.preventDefault();
    if (!tipForm.psId) {
      alert('Police Station is required');
      return;
    }
    setTipSaving(true);
    try {
      await api.post('/intelligence', {
        ...tipForm,
        sourceType: 'INFORMER',
      });
      alert('Tip-off logged successfully!');
      setTipForm({ informerId: '', offenderId: '', psId: perms.policeStationId || '', inputText: '', supplyRoute: '' });
      setInformerSubTab('list');
    } catch (err) {
      alert('Failed to log tip-off intelligence');
    } finally {
      setTipSaving(false);
    }
  };

  // Tab configurations
  const currentTabTitle = activeTabObj?.label;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Field Operations Hub
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Real-time coordinates verification, voice-to-text notes, and offender scoping checks
          </p>
        </div>

        {/* Global Geolocation Indicator */}
        <div 
          onClick={captureGps}
          className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer select-none transition-all duration-200"
          style={{
            background: gps.error ? 'rgba(239, 68, 68, 0.08)' : gps.lat ? 'rgba(34, 197, 94, 0.08)' : 'rgba(100, 116, 139, 0.08)',
            borderColor: gps.error ? 'rgba(239, 68, 68, 0.2)' : gps.lat ? 'rgba(34, 197, 94, 0.2)' : 'rgba(100, 116, 139, 0.2)',
            color: gps.error ? '#f87171' : gps.lat ? '#4ade80' : '#94a3b8',
          }}
        >
          {gps.loading ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Locating GPS...</span>
            </>
          ) : gps.error ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>{gps.error}</span>
            </>
          ) : gps.lat ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" style={{ width: '10px', height: '10px' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
              <span>Geo-tagged: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span>GPS Inactive</span>
            </>
          )}
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--color-garuda-700)', paddingBottom: '0.75rem' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm flex items-center gap-1.5 ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : tab.color} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* -------------------------------------------------------------
          TAB CONTENT PANEL
         ------------------------------------------------------------- */}
      <div 
        className="card rounded-xl p-6 border border-slate-100/50 dark:border-slate-800"
        style={{ background: 'var(--color-garuda-800)' }}
      >
        {/* Render Tab 1: Quick Case Entry */}
        {activeTab === 'quick-entry' && (
          <form onSubmit={handleQuickSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>FIR / Entry Number</label>
                <input
                  type="text"
                  placeholder="Leave blank for auto-generated code"
                  value={quickForm.firNo}
                  onChange={e => setQuickForm({ ...quickForm, firNo: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Allotted Police Station *</label>
                <select
                  value={quickForm.psId}
                  onChange={e => setQuickForm({ ...quickForm, psId: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">— Select Station —</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.psCode})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Section of Law</label>
                <input
                  type="text"
                  placeholder="e.g. 20(b)(ii)(B) NDPS Act"
                  value={quickForm.sectionOfLaw}
                  onChange={e => setQuickForm({ ...quickForm, sectionOfLaw: e.target.value })}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Seized Quantity</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={quickForm.quantity}
                    onChange={e => setQuickForm({ ...quickForm, quantity: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Unit</label>
                  <select
                    value={quickForm.quantityUnit}
                    onChange={e => setQuickForm({ ...quickForm, quantityUnit: e.target.value })}
                    className="select"
                  >
                    <option value="KG">KG</option>
                    <option value="GRAMS">Grams</option>
                    <option value="TABLETS">Tablets</option>
                    <option value="ML">ML</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Contraband Type</label>
                <select
                  value={quickForm.contrabandType}
                  onChange={e => setQuickForm({ ...quickForm, contrabandType: e.target.value })}
                  className="select"
                >
                  <option value="DRY_GANJA">Dry Ganja</option>
                  <option value="GANJA_OIL">Ganja Oil</option>
                  <option value="BROWN_SUGAR">Brown Sugar</option>
                  <option value="HEROIN">Heroin</option>
                  <option value="MDMA">MDMA</option>
                  <option value="COCAINE">Cocaine</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Estimated Street Value (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={quickForm.streetValue}
                  onChange={e => setQuickForm({ ...quickForm, streetValue: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Source Location</label>
                <input
                  type="text"
                  placeholder="e.g. Araku Valley, AP"
                  value={quickForm.sourceLocation}
                  onChange={e => setQuickForm({ ...quickForm, sourceLocation: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Destination Location</label>
                <input
                  type="text"
                  placeholder="e.g. Tirupati Town"
                  value={quickForm.destinationLocation}
                  onChange={e => setQuickForm({ ...quickForm, destinationLocation: e.target.value })}
                  className="input"
                />
              </div>

              {/* Photo attachment stub */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-garuda-200)' }}>Attach Field Photo</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="block text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-slate-100 hover:file:bg-slate-600 cursor-pointer"
                  />
                  {uploadingPhoto && <span className="text-xs text-amber-400">Uploading photo...</span>}
                  {quickForm.relevantFiles && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      ✓ Attached: <a href={quickForm.relevantFiles} target="_blank" rel="noreferrer" className="underline font-mono">View Photo</a>
                    </span>
                  )}
                </div>
              </div>

              {/* Case Summary Dictation Area */}
              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium" style={{ color: 'var(--color-garuda-200)' }}>Case Summary / Intelligence Notes</label>
                  
                  {/* Microphone dictation button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) stopVoiceTyping();
                      else startVoiceTyping((text) => setQuickForm(prev => ({ ...prev, intelligenceNotes: prev.intelligenceNotes ? `${prev.intelligenceNotes} ${text}` : text })));
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border cursor-pointer ${
                      isListening 
                        ? 'bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20' 
                        : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                        <span>Listening... Stop</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3z" />
                        </svg>
                        <span>Voice Type</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows="4"
                  value={quickForm.intelligenceNotes}
                  onChange={e => setQuickForm({ ...quickForm, intelligenceNotes: e.target.value })}
                  placeholder="Record summary details of the seizure, suspects details, or click 'Voice Type' to dictate..."
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
              <button
                type="submit"
                disabled={quickSubmitting}
                className="btn btn-primary px-6"
              >
                {quickSubmitting ? 'Logging Case...' : 'Submit Quick Entry'}
              </button>
            </div>
          </form>
        )}

        {/* Render Tab 2: Accused Verification */}
        {activeTab === 'verify' && (
          <div className="space-y-6">
            {/* Search Input Box */}
            <form onSubmit={handleVerifySearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter Accused Full Name, Mobile number, or Aadhaar No..."
                className="input flex-1"
                required
              />
              <button type="submit" disabled={searchLoading} className="btn btn-primary flex items-center gap-1.5">
                <IconSearch size={14} color="#fff" />
                <span>Verify</span>
              </button>
            </form>

            {/* Results Grid */}
            {searchLoading ? (
              <div className="py-12 text-center text-slate-400 animate-pulse">Searching offender registry database...</div>
            ) : searchResults.length === 0 ? (
              searchQuery && (
                <div className="py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                  No registered offenders found matching "{searchQuery}"
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map(o => (
                  <div 
                    key={o.id}
                    className="p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between"
                    style={{ background: 'var(--color-garuda-900)' }}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-slate-200">
                          {o.photoUrl ? (
                            <img src={o.photoUrl} alt={o.fullName} className="w-full h-full object-cover" />
                          ) : (
                            o.fullName.substring(0,2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm" style={{ color: 'var(--color-garuda-50)' }}>{o.fullName}</h4>
                          {o.alias && <p className="text-xs text-slate-400">alias: {o.alias}</p>}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300">
                        <p><strong>PS:</strong> {o.psName || '—'}</p>
                        <p><strong>Category:</strong> {o.category?.replace(/_/g,' ') || '—'}</p>
                        <p><strong>Mobile:</strong> {o.mobile || '—'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'ABSCONDING' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        o.status === 'ARRESTED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        o.status === 'BAILED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {o.status}
                      </span>
                      <button 
                        onClick={() => openDossier(o)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold text-white cursor-pointer"
                      >
                        View Dossier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Accused Dossier Detail Modal */}
            {selectedOffender && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="absolute inset-0" onClick={() => setSelectedOffender(null)}></div>
                <div 
                  className="rounded-xl relative w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col"
                  style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
                >
                  {/* Modal Header */}
                  <div className="px-6 py-4 flex justify-between items-center border-b border-slate-700">
                    <h3 className="text-lg font-bold" style={{ color: 'var(--color-garuda-50)' }}>
                      Accused Dossier: {selectedOffender.fullName}
                    </h3>
                    <button 
                      onClick={() => setSelectedOffender(null)}
                      className="text-slate-400 hover:text-white cursor-pointer text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto">
                    {/* Left Column: Profile Card */}
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl text-center space-y-3" style={{ background: 'var(--color-garuda-900)' }}>
                        <div className="w-28 h-28 mx-auto rounded-xl bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-3xl text-slate-100">
                          {selectedOffender.photoUrl ? (
                            <img src={selectedOffender.photoUrl} alt={selectedOffender.fullName} className="w-full h-full object-cover" />
                          ) : (
                            selectedOffender.fullName?.substring(0,2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-base" style={{ color: 'var(--color-garuda-50)' }}>{selectedOffender.fullName}</h4>
                          {selectedOffender.alias && <p className="text-xs text-slate-400">alias: {selectedOffender.alias}</p>}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 uppercase font-semibold">
                            Rank: {selectedOffender.category?.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            selectedOffender.riskScore === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                            selectedOffender.riskScore === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            Risk: {selectedOffender.riskScore || 'LOW'}
                          </span>
                        </div>
                      </div>

                      {/* Contacts & Financial Summary */}
                      <div className="p-4 rounded-xl space-y-3 text-xs" style={{ background: 'var(--color-garuda-900)' }}>
                        <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">Contacts</h4>
                        {selectedOffender.contacts?.length > 0 ? (
                          selectedOffender.contacts.map((c, i) => (
                            <p key={i} className="text-slate-300"><strong>{c.contactType}:</strong> {c.value}</p>
                          ))
                        ) : (
                          <p className="text-slate-500">No contact values registered</p>
                        )}

                        <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[10px] pt-2">Financial Identifiers</h4>
                        {selectedOffender.financials?.length > 0 ? (
                          selectedOffender.financials.map((f, i) => (
                            <p key={i} className="text-slate-300"><strong>{f.finType}:</strong> {f.value} {f.bankName && `(${f.bankName})`}</p>
                          ))
                        ) : (
                          <p className="text-slate-500">No financial details logged</p>
                        )}
                      </div>
                    </div>

                    {/* Middle Column: Personal & Drug Info */}
                    <div className="space-y-4 lg:col-span-2">
                      <div className="p-5 rounded-xl space-y-4" style={{ background: 'var(--color-garuda-900)' }}>
                        <h4 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">Profile Details</h4>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                          <p><strong>Father/Husband:</strong> {selectedOffender.fatherHusbandName || '—'}</p>
                          <p><strong>Age / Gender:</strong> {selectedOffender.age ? `${selectedOffender.age} yrs` : '—'} / {selectedOffender.gender || '—'}</p>
                          <p><strong>Address:</strong> {selectedOffender.fullAddress || '—'}</p>
                          <p><strong>Landmark:</strong> {selectedOffender.landmarkArea || '—'}</p>
                          <p><strong>District/State:</strong> {selectedOffender.district || '—'}, {selectedOffender.state || '—'}</p>
                          <p><strong>Occupation:</strong> {selectedOffender.occupation || '—'}</p>
                        </div>

                        {/* Aadhaar masking/reveal section */}
                        <div className="p-3 bg-slate-800/60 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="block text-slate-400 text-[10px] uppercase font-bold tracking-wider">Aadhaar Document Number</span>
                            <span className="font-mono text-sm font-semibold text-slate-200">
                              {aadhaarRevealed ? revealedAadhaarVal : (selectedOffender.aadhaarNo || '—')}
                            </span>
                          </div>
                          {!aadhaarRevealed && (selectedOffender.aadhaarNo || selectedOffender.identityDocs?.aadhaarNo) && (
                            <button
                              onClick={handleRevealAadhaar}
                              className="px-2.5 py-1 bg-slate-700 text-slate-200 hover:text-white rounded font-medium text-[10px]"
                            >
                              👁 Reveal
                            </button>
                          )}
                        </div>

                        <h4 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2 pt-2">Drug Consumption Profile</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                          <p><strong>Addiction:</strong> {selectedOffender.addictionType || '—'}</p>
                          <p><strong>Frequency:</strong> {selectedOffender.consumptionFrequency || '—'}</p>
                          <p><strong>Source:</strong> {selectedOffender.sourceOfProcurement || '—'}</p>
                          <p><strong>Purchase Mode:</strong> {selectedOffender.modeOfPurchase || '—'}</p>
                          <p className="col-span-2"><strong>Consumption Spot:</strong> {selectedOffender.usualConsumptionSpot || '—'}</p>
                        </div>
                      </div>

                      {/* Right Timeline: Case History */}
                      <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-900)' }}>
                        <h4 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2 mb-4">Case History Timeline</h4>
                        {timelineLoading ? (
                          <div className="py-6 text-center text-slate-500 text-xs">Loading linked cases...</div>
                        ) : offenderTimeline.length === 0 ? (
                          <div className="py-6 text-center text-slate-500 text-xs">No NDPS cases linked to this accused.</div>
                        ) : (
                          <div className="relative pl-6 border-l border-slate-800 space-y-6">
                            {offenderTimeline.map((caseItem, idx) => (
                              <div key={caseItem.id} className="relative">
                                {/* Timeline Dot */}
                                <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[var(--color-garuda-900)]" />
                                
                                <div className="text-xs space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="font-mono font-bold text-slate-100">{caseItem.firNo}</span>
                                    <span className="text-[10px] text-slate-400">
                                      {caseItem.caseDate ? new Date(caseItem.caseDate).toLocaleDateString('en-IN') : '—'}
                                    </span>
                                  </div>
                                  <p className="text-slate-300"><strong>Station:</strong> {caseItem.psName} | <strong>Section:</strong> {caseItem.sectionOfLaw || '—'}</p>
                                  <p className="text-slate-400"><strong>Contraband:</strong> {caseItem.contrabandType} ({caseItem.quantity} {caseItem.quantityUnit})</p>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    caseItem.stage === 'CONVICTED' ? 'bg-emerald-500/10 text-emerald-400' :
                                    caseItem.stage === 'FIR' ? 'bg-indigo-500/10 text-indigo-400' :
                                    'bg-slate-700 text-slate-300'
                                  }`}>
                                    {caseItem.stage}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Render Tab 3: GPS-Tagged Surveillance */}
        {activeTab === 'surveillance' && (
          <form onSubmit={handleSurvSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Select Accused Offender *</label>
                <select
                  value={survForm.offenderId}
                  onChange={e => setSurvForm({ ...survForm, offenderId: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">— Choose Accused —</option>
                  {offendersList.map(o => <option key={o.id} value={o.id}>{o.fullName} {o.alias && `(alias: ${o.alias})`} - {o.psName}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Surveillance Check-in Status</label>
                <select
                  value={survForm.status}
                  onChange={e => setSurvForm({ ...survForm, status: e.target.value })}
                  className="select"
                >
                  <option value="PENDING">Pending Check</option>
                  <option value="COMPLETED">Successfully Verified (Completed)</option>
                  <option value="MISSED">Unable to Verify (Missed)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Current Observed Address</label>
                <input
                  type="text"
                  placeholder="e.g. D.No: 12-3, Ram Nagar, Tirupati"
                  value={survForm.currentAddress}
                  onChange={e => setSurvForm({ ...survForm, currentAddress: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Current Occupation Details</label>
                <input
                  type="text"
                  placeholder="e.g. Daily wage labour, Auto driver"
                  value={survForm.currentOccupation}
                  onChange={e => setSurvForm({ ...survForm, currentOccupation: e.target.value })}
                  className="input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Associates Observed (Separated by commas)</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Goud, Shekhar Babu"
                  value={survForm.associatesNoted}
                  onChange={e => setSurvForm({ ...survForm, associatesNoted: e.target.value })}
                  className="input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Surveillance Notes</label>
                <textarea
                  rows="3"
                  value={survForm.notes}
                  onChange={e => setSurvForm({ ...survForm, notes: e.target.value })}
                  placeholder="Record verification details, suspect behavior or residential remarks..."
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
              <button
                type="submit"
                disabled={survSubmitting}
                className="btn btn-primary px-6"
              >
                {survSubmitting ? 'Saving check-in...' : 'Log Surveillance Check'}
              </button>
            </div>
          </form>
        )}

        {/* Render Tab 4: Informer Management */}
        {activeTab === 'informer' && (
          <div className="space-y-6 animate-fade-in">
            {/* Informer Sub Tabs Navigation */}
            <div className="flex gap-2 border-b border-slate-700 pb-2">
              <button
                onClick={() => setInformerSubTab('list')}
                className={`px-3 py-1 rounded text-xs font-semibold ${informerSubTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Informer Directory
              </button>
              <button
                onClick={() => setInformerSubTab('register')}
                className={`px-3 py-1 rounded text-xs font-semibold ${informerSubTab === 'register' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Register Informer
              </button>
              <button
                onClick={() => setInformerSubTab('tip-off')}
                className={`px-3 py-1 rounded text-xs font-semibold ${informerSubTab === 'tip-off' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Log Intelligence Tip-off
              </button>
            </div>

            {/* Sub-tab 1: Directory List */}
            {informerSubTab === 'list' && (
              <div className="space-y-4">
                {infLoading ? (
                  <div className="py-8 text-center text-slate-400 animate-pulse">Fetching informer profiles...</div>
                ) : informers.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                    No informers registered under this police jurisdiction.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="bg-slate-900" style={{ color: 'var(--color-garuda-200)' }}>
                          <th className="px-4 py-3">Code Name</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3 text-center">Reliability Rating</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3">Registered By</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {informers.map((inf) => (
                          <tr key={inf.id} className="border-b border-slate-800 hover:bg-slate-700/10">
                            <td className="px-4 py-3 font-bold text-indigo-400 font-mono">{inf.codeName}</td>
                            <td className="px-4 py-3 text-slate-300">{inf.phone || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inf.rating === 'A' ? 'bg-emerald-500/20 text-emerald-400' :
                                inf.rating === 'B' ? 'bg-indigo-500/20 text-indigo-400' :
                                inf.rating === 'C' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {inf.rating}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inf.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                {inf.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{inf.createdByName}</td>
                            <td className="px-4 py-3 text-slate-400">
                              {new Date(inf.createdAt).toLocaleDateString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleToggleInformerStatus(inf.id, inf.status)}
                                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${inf.status === 'ACTIVE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}
                              >
                                {inf.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Register Form */}
            {informerSubTab === 'register' && (
              <form onSubmit={handleRegisterInformer} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Confidential Code Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. INF-Tirupati-08"
                    value={regForm.codeName}
                    onChange={e => setRegForm({ ...regForm, codeName: e.target.value })}
                    className="input"
                    required
                  />
                  <p className="text-[10px] text-amber-500 mt-1">IMPORTANT: Do not write real names in code names to protect contact security.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Contact Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={regForm.phone}
                    onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Reliability Rating</label>
                  <select
                    value={regForm.rating}
                    onChange={e => setRegForm({ ...regForm, rating: e.target.value })}
                    className="select"
                  >
                    <option value="A">Class A (Highly Reliable)</option>
                    <option value="B">Class B (Generally Reliable)</option>
                    <option value="C">Class C (Fairly Reliable)</option>
                    <option value="D">Class D (Unreliable / Verify)</option>
                  </select>
                </div>
                <button type="submit" disabled={regSaving} className="btn btn-primary w-full">
                  {regSaving ? 'Registering...' : 'Register Informer'}
                </button>
              </form>
            )}

            {/* Sub-tab 3: Log Tip-off Form */}
            {informerSubTab === 'tip-off' && (
              <form onSubmit={handleTipSubmit} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Select Informer Contact *</label>
                  <select
                    value={tipForm.informerId}
                    onChange={e => setTipForm({ ...tipForm, informerId: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="">— Select Informer —</option>
                    {informers.filter(i => i.status === 'ACTIVE').map(i => (
                      <option key={i.id} value={i.id}>{i.codeName} (Rating: {i.rating})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Police Station Scope *</label>
                  <select
                    value={tipForm.psId}
                    onChange={e => setTipForm({ ...tipForm, psId: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="">— Select Station —</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.psCode})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Target Offender (Optional)</label>
                  <select
                    value={tipForm.offenderId}
                    onChange={e => setTipForm({ ...tipForm, offenderId: e.target.value })}
                    className="select"
                  >
                    <option value="">— Select Offender —</option>
                    {offendersList.map(o => <option key={o.id} value={o.id}>{o.fullName} - {o.psName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Suspected Drug Supply Route</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangalore -> Tirupati bypass road"
                    value={tipForm.supplyRoute}
                    onChange={e => setTipForm({ ...tipForm, supplyRoute: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-garuda-300)' }}>Intelligence / Tip-off details</label>
                  <textarea
                    rows="3"
                    value={tipForm.inputText}
                    onChange={e => setTipForm({ ...tipForm, inputText: e.target.value })}
                    placeholder="Provide details about vehicle types, drug weight, delivery spots, or meeting times..."
                    className="input"
                  />
                </div>
                <button type="submit" disabled={tipSaving} className="btn btn-primary w-full">
                  {tipSaving ? 'Logging Tip-off...' : 'Log Informer Tip-off'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Render Tab 5: Checkpoint / Nakabandhi Logs */}
        {activeTab === 'checkpoint' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold mb-3 border-b border-slate-700 pb-2" style={{ color: 'var(--color-garuda-100)' }}>
              Log Nakabandhi Vehicle Check
            </h3>
            <VehicleCheckForm 
              onCancel={() => setActiveTab('quick-entry')} 
              onSuccess={() => setActiveTab('checkpoint')} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
