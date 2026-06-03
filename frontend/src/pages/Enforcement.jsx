/**
 * GARUDA — Field Enforcement Module
 * Route: /enforcement
 *
 * 3-Tab Layout:
 *   Tab 1: Field Check — create enforcement check + identity lookup + drug test
 *   Tab 2: SHO Review — pending positive cases for SHO approval (SHO+ only)
 *   Tab 3: Dashboard — enforcement analytics (role-scoped)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const TABS = [
  { key: 'field', label: 'Field Check', icon: '🔍' },
  { key: 'review', label: 'SHO Review', icon: '✅', requireReview: true },
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
];

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

const CONSUMPTION_TYPES = [
  'Ganja', 'Brown Sugar', 'Heroin', 'MDMA', 'Synthetic', 'Cocaine', 'Opium', 'Other',
];

const STATUS_COLORS = {
  FIELD_CREATED: { bg: '#3b82f620', text: '#3b82f6', label: 'Field Created' },
  NEGATIVE_CLOSED: { bg: '#22c55e20', text: '#22c55e', label: 'Negative — Closed' },
  PENDING_SHO_REVIEW: { bg: '#f59e0b20', text: '#f59e0b', label: 'Pending SHO Review' },
  SHO_APPROVED: { bg: '#8b5cf620', text: '#8b5cf6', label: 'SHO Approved' },
  SHO_REJECTED: { bg: '#ef444420', text: '#ef4444', label: 'SHO Rejected' },
};

const RESULT_COLORS = {
  POSITIVE: { bg: '#ef444420', text: '#ef4444' },
  NEGATIVE: { bg: '#22c55e20', text: '#22c55e' },
  PENDING: { bg: '#6b728020', text: '#6b7280' },
};

const CHART_COLORS = ['#ef4444', '#22c55e', '#6b7280'];

export default function Enforcement() {
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState('field');

  const visibleTabs = TABS.filter(t => !t.requireReview || perms.canEnforcementReview);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))',
          borderColor: 'rgba(59, 130, 246, 0.2)',
        }}
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Field Enforcement
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Drug test verification, identity lookups, and consumer database ingestion workflow
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer border-none"
            style={{
              background: activeTab === tab.key ? 'var(--color-accent-500)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--color-garuda-400)',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'field' && <FieldCheckTab />}
      {activeTab === 'review' && perms.canEnforcementReview && <SHOReviewTab />}
      {activeTab === 'dashboard' && <EnforcementDashboardTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TAB 1: Field Check
// ─────────────────────────────────────────────────────────────────────────
function FieldCheckTab() {
  const [step, setStep] = useState('form'); // form → lookup → test → done
  const [form, setForm] = useState({ subjectName: '', subjectAge: '', subjectGender: '', subjectAadhaar: '', placeOfEnforcement: '', photoUrl: '' });
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [lookupResults, setLookupResults] = useState([]);
  const [testResult, setTestResult] = useState('');
  const [consumptionType, setConsumptionType] = useState('');
  const [message, setMessage] = useState(null);

  // Camera & Upload States
  const [cameraActive, setCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const videoRef = useRef(null);

  const resetForm = () => {
    setStep('form');
    setForm({ subjectName: '', subjectAge: '', subjectGender: '', subjectAadhaar: '', placeOfEnforcement: '', photoUrl: '' });
    setCheckResult(null);
    setLookupResults([]);
    setTestResult('');
    setConsumptionType('');
    setMessage(null);
    stopCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setMediaStream(stream);
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access failed:', err);
      setMessage({ type: 'error', text: 'Failed to access camera. Please check permissions or use standard upload.' });
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
    setCameraActive(false);
  };

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream]);

  // Bind stream to video element
  useEffect(() => {
    if (cameraActive && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [cameraActive, mediaStream]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setUploadingPhoto(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await uploadFile(file);
      }
      stopCamera();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to capture photo.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Photo file size must be under 5MB' });
      return;
    }
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    setUploadingPhoto(true);
    setMessage(null);
    try {
      const res = await api.post('/offenders/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.data?.url) {
        setForm(f => ({ ...f, photoUrl: res.data.data.url }));
      } else {
        setMessage({ type: 'error', text: 'Upload succeeded but no URL was returned' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to upload photo' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmitCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post('/enforcement', form);
      setCheckResult(res.data.data);
      setLookupResults(res.data.data.lookupResults || []);
      setStep('lookup');
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create check' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!testResult) return;
    if (testResult === 'POSITIVE' && !consumptionType) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.put(`/enforcement/${checkResult.id}/test-result`, {
        testResult,
        consumptionType: testResult === 'POSITIVE' ? consumptionType : null,
      });
      setCheckResult(res.data.data);
      setStep('done');
      setMessage({
        type: testResult === 'NEGATIVE' ? 'success' : 'warning',
        text: res.data.message,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit test result' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-3 px-2">
        {['Demographics', 'Identity Lookup', 'Drug Test', 'Result'].map((label, i) => {
          const stepIdx = ['form', 'lookup', 'test', 'done'].indexOf(step);
          const active = i === stepIdx;
          const completed = i < stepIdx;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: completed ? '#22c55e' : active ? 'var(--color-accent-500)' : 'var(--color-garuda-700)',
                  color: completed || active ? '#fff' : 'var(--color-garuda-400)',
                }}
              >
                {completed ? '✓' : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline" style={{ color: active ? 'var(--color-garuda-100)' : 'var(--color-garuda-500)' }}>
                {label}
              </span>
              {i < 3 && <div className="w-8 h-px" style={{ background: completed ? '#22c55e' : 'var(--color-garuda-700)' }} />}
            </div>
          );
        })}
      </div>

      {message && (
        <div className="p-3 rounded-lg text-sm font-medium"
          style={{
            background: message.type === 'error' ? '#ef444420' : message.type === 'warning' ? '#f59e0b20' : '#22c55e20',
            color: message.type === 'error' ? '#ef4444' : message.type === 'warning' ? '#f59e0b' : '#22c55e',
            border: `1px solid ${message.type === 'error' ? '#ef444440' : message.type === 'warning' ? '#f59e0b40' : '#22c55e40'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Step 1: Demographics Form */}
      {step === 'form' && (
        <form onSubmit={handleSubmitCheck} className="card p-6 space-y-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-garuda-100)' }}>
            Subject Demographics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Full Name *</label>
              <input type="text" required value={form.subjectName} onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                placeholder="Enter full name" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Age</label>
              <input type="number" min="1" max="120" value={form.subjectAge} onChange={e => setForm(f => ({ ...f, subjectAge: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                placeholder="Age" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Gender</label>
              <select value={form.subjectGender} onChange={e => setForm(f => ({ ...f, subjectGender: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}>
                <option value="">Select gender</option>
                {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Aadhaar Number</label>
              <input type="text" maxLength={12} value={form.subjectAadhaar} onChange={e => setForm(f => ({ ...f, subjectAadhaar: e.target.value.replace(/\D/g, '') }))}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                placeholder="12-digit Aadhaar" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Place of Enforcement *</label>
              <input type="text" required value={form.placeOfEnforcement} onChange={e => setForm(f => ({ ...f, placeOfEnforcement: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                placeholder="Location / area / checkpoint" />
            </div>

            {/* Live Camera & Photograph Upload */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Subject Photograph</label>
              <div className="flex flex-col gap-3 p-4 rounded-xl border" style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-700)' }}>
                {form.photoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                      <img src={form.photoUrl} alt="Subject Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, photoUrl: '' }))}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-red-400 font-bold opacity-0 hover:opacity-100 transition-opacity cursor-pointer border-none"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-green-400">✓ Photograph Captured Successfully</p>
                      <p className="text-[10px] text-slate-500 mt-1">Click image to remove/retake</p>
                    </div>
                  </div>
                ) : cameraActive ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden border border-slate-700 bg-black">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                          <span className="text-xs text-slate-300 animate-pulse">Uploading Photograph...</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 w-full max-w-sm">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={uploadingPhoto}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold border-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        📸 Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        disabled={uploadingPhoto}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold border-none cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={uploadingPhoto}
                      className="w-full sm:w-auto px-4 py-2.5 bg-accent-500/10 hover:bg-accent-500/20 text-accent-400 border border-accent-500/30 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-2 transition-all"
                    >
                      📷 Use Live Camera
                    </button>
                    <div className="text-xs text-slate-500 font-medium">or</div>
                    <div className="flex-1 w-full">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        disabled={uploadingPhoto}
                        className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-accent-500/10 file:text-accent-400 hover:file:bg-accent-500/20 file:cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Choose image or use mobile camera</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading || uploadingPhoto}
              className="px-5 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer transition-all"
              style={{ background: 'var(--color-accent-500)', color: '#fff', opacity: (loading || uploadingPhoto) ? 0.6 : 1 }}>
              {loading ? 'Checking…' : 'Submit & Run Lookup'}
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Identity Lookup Results */}
      {step === 'lookup' && checkResult && (
        <div className="card p-6 space-y-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-garuda-100)' }}>
            Target Verification Matrix
          </h2>

          {/* Subject Summary */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {checkResult.photo_url && (
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                <img src={checkResult.photo_url} alt="Subject" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full">
              {[
                { label: 'Name', value: checkResult.subject_name },
                { label: 'Age/Gender', value: `${checkResult.subject_age || '—'} / ${checkResult.subject_gender || '—'}` },
                { label: 'Aadhaar', value: checkResult.subject_aadhaar ? `****${checkResult.subject_aadhaar.slice(-4)}` : '—' },
                { label: 'Place', value: checkResult.place_of_enforcement },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
                  <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>{item.label}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-garuda-100)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Lookup Results */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-garuda-200)' }}>Lookup Results</h3>
            {/* NDPS Check */}
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{
              background: checkResult.ndps_match ? '#ef444415' : '#22c55e15',
              border: `1px solid ${checkResult.ndps_match ? '#ef444430' : '#22c55e30'}`,
            }}>
              <span className="text-lg">{checkResult.ndps_match ? '⚠️' : '✅'}</span>
              <div>
                <div className="text-sm font-bold" style={{ color: checkResult.ndps_match ? '#ef4444' : '#22c55e' }}>
                  NDPS Check: {checkResult.ndps_match ? 'MATCH FOUND' : 'No prior drug offenses'}
                </div>
              </div>
            </div>
            {/* Criminal Record */}
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{
              background: checkResult.criminal_record_found ? '#f59e0b15' : '#22c55e15',
              border: `1px solid ${checkResult.criminal_record_found ? '#f59e0b30' : '#22c55e30'}`,
            }}>
              <span className="text-lg">{checkResult.criminal_record_found ? '🔴' : '✅'}</span>
              <div>
                <div className="text-sm font-bold" style={{ color: checkResult.criminal_record_found ? '#f59e0b' : '#22c55e' }}>
                  Criminal Record: {checkResult.criminal_record_found ? 'PRIOR RECORD FOUND' : 'No prior criminal record'}
                </div>
              </div>
            </div>
            {/* Detailed lookup lines */}
            {lookupResults.length > 0 && (
              <div className="p-3 rounded-lg space-y-1" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--color-garuda-500)' }}>Details</div>
                {lookupResults.map((line, i) => (
                  <div key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--color-garuda-300)' }}>
                    <span className="text-accent-500 mt-0.5">•</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={() => setStep('test')}
              className="px-5 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer"
              style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
              Proceed to Drug Test →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Drug Test */}
      {step === 'test' && checkResult && (
        <div className="card p-6 space-y-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-garuda-100)' }}>
            Drug Test Validation
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>
            Administer the drug test and record the result for <strong style={{ color: 'var(--color-garuda-200)' }}>{checkResult.subject_name}</strong>.
          </p>

          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
            {checkResult.photo_url && (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                <img src={checkResult.photo_url} alt="Subject" className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{checkResult.subject_name}</p>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                {checkResult.subject_age ? `${checkResult.subject_age} yrs` : ''} {checkResult.subject_gender ? `• ${checkResult.subject_gender}` : ''}
              </p>
            </div>
          </div>

          {/* Test Result Selection */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: 'NEGATIVE', label: 'Negative (-ve)', desc: 'No substances detected. Session will be closed.', color: '#22c55e', icon: '✅' },
              { value: 'POSITIVE', label: 'Positive (+ve)', desc: 'Substances detected. Will escalate to SHO for review.', color: '#ef4444', icon: '⚠️' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setTestResult(opt.value)}
                className="p-5 rounded-xl text-left transition-all duration-200 border-2 cursor-pointer"
                style={{
                  background: testResult === opt.value ? `${opt.color}15` : 'var(--color-garuda-900)',
                  borderColor: testResult === opt.value ? opt.color : 'var(--color-garuda-700)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-base font-bold" style={{ color: opt.color }}>{opt.label}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* Consumption Type (only for positive) */}
          {testResult === 'POSITIVE' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Type of Consumption *</label>
              <div className="flex flex-wrap gap-2">
                {CONSUMPTION_TYPES.map(ct => (
                  <button key={ct} onClick={() => setConsumptionType(ct)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all"
                    style={{
                      background: consumptionType === ct ? 'var(--color-accent-500)' : 'var(--color-garuda-900)',
                      borderColor: consumptionType === ct ? 'var(--color-accent-500)' : 'var(--color-garuda-600)',
                      color: consumptionType === ct ? '#fff' : 'var(--color-garuda-300)',
                    }}>
                    {ct}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setStep('lookup')}
              className="px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer"
              style={{ background: 'transparent', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-300)' }}>
              ← Back
            </button>
            <button
              onClick={handleSubmitTest}
              disabled={loading || !testResult || (testResult === 'POSITIVE' && !consumptionType)}
              className="px-5 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer transition-all"
              style={{
                background: testResult === 'NEGATIVE' ? '#22c55e' : testResult === 'POSITIVE' ? '#ef4444' : 'var(--color-garuda-600)',
                color: '#fff',
                opacity: (!testResult || loading || (testResult === 'POSITIVE' && !consumptionType)) ? 0.5 : 1,
              }}>
              {loading ? 'Submitting…' : testResult === 'NEGATIVE' ? 'Close Session' : testResult === 'POSITIVE' ? 'Escalate to SHO' : 'Select Result'}
            </button>
          </div>
        </div>
      )}


      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="card p-8 text-center space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="text-5xl">{testResult === 'NEGATIVE' ? '✅' : '📋'}</div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-garuda-100)' }}>
            {testResult === 'NEGATIVE' ? 'Session Closed' : 'Escalated to SHO'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>
            {testResult === 'NEGATIVE'
              ? 'No substances detected. The check has been logged and the session is now closed. An audit trail has been created.'
              : `Positive test result for "${checkResult?.subject_name}" has been flagged with consumption type "${consumptionType}". The SHO will review and commit to the consumer database.`}
          </p>
          <button onClick={resetForm}
            className="px-5 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer mt-4"
            style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
            Start New Check
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TAB 2: SHO Review
// ─────────────────────────────────────────────────────────────────────────
function SHOReviewTab() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [message, setMessage] = useState(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get('/enforcement/pending-review');
      setChecks(res.data.data.checks || []);
    } catch (err) {
      console.error('Failed to fetch pending reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleReview = async (id, action) => {
    setActionLoading(id);
    setMessage(null);
    try {
      const res = await api.put(`/enforcement/${id}/review`, {
        action,
        reviewNotes: reviewNotes[id] || '',
      });
      setMessage({ type: 'success', text: res.data.message });
      fetchPending(); // refresh list
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Review failed' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 text-center" style={{ background: 'var(--color-garuda-800)' }}>
        <div className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Loading pending reviews…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 rounded-lg text-sm font-medium"
          style={{
            background: message.type === 'error' ? '#ef444420' : '#22c55e20',
            color: message.type === 'error' ? '#ef4444' : '#22c55e',
            border: `1px solid ${message.type === 'error' ? '#ef444440' : '#22c55e40'}`,
          }}>
          {message.text}
        </div>
      )}

      {checks.length === 0 ? (
        <div className="card p-12 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <div className="text-4xl mb-3">✅</div>
          <h3 className="text-base font-bold" style={{ color: 'var(--color-garuda-200)' }}>No Pending Reviews</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>All positive enforcement checks have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: 'var(--color-garuda-100)' }}>
              Pending Reviews ({checks.length})
            </h2>
          </div>

          {checks.map(check => (
            <div key={check.id} className="card p-5 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  {check.photo_url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                      <img src={check.photo_url} alt={check.subject_name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-slate-700 bg-slate-800/40 flex items-center justify-center flex-shrink-0 text-slate-500 text-xl">
                      👤
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--color-garuda-100)' }}>
                      {check.subject_name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                      <span>Age: {check.subject_age || '—'}</span>
                      <span>•</span>
                      <span>Gender: {check.subject_gender || '—'}</span>
                      <span>•</span>
                      <span>PS: {check.police_station?.name || '—'}</span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase" style={{
                  background: '#ef444420', color: '#ef4444',
                }}>Test +ve</span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span style={{ color: 'var(--color-garuda-500)' }}>Place:</span> <span style={{ color: 'var(--color-garuda-200)' }}>{check.place_of_enforcement}</span></div>
                <div><span style={{ color: 'var(--color-garuda-500)' }}>Consumption:</span> <span style={{ color: 'var(--color-garuda-200)' }}>{check.consumption_type || '—'}</span></div>
                <div><span style={{ color: 'var(--color-garuda-500)' }}>Officer:</span> <span style={{ color: 'var(--color-garuda-200)' }}>{check.officer?.full_name || '—'}</span></div>
                <div><span style={{ color: 'var(--color-garuda-500)' }}>Date:</span> <span style={{ color: 'var(--color-garuda-200)' }}>{new Date(check.created_at).toLocaleDateString()}</span></div>
              </div>

              {/* Lookup flags */}
              <div className="flex gap-3">
                {check.ndps_match && (
                  <span className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: '#ef444420', color: '#ef4444' }}>
                    ⚠ NDPS Match
                  </span>
                )}
                {check.criminal_record_found && (
                  <span className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                    🔴 Criminal Record
                  </span>
                )}
                {check.matched_offender && (
                  <span className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
                    Linked: {check.matched_offender.full_name}
                  </span>
                )}
              </div>

              {/* Review Notes + Actions */}
              <div className="flex flex-col md:flex-row items-end gap-3 pt-2 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
                <div className="flex-1 w-full">
                  <label className="block text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-garuda-500)' }}>Review Notes</label>
                  <input type="text" value={reviewNotes[check.id] || ''}
                    onChange={e => setReviewNotes(prev => ({ ...prev, [check.id]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                    placeholder="Optional notes…" />
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleReview(check.id, 'reject')}
                    disabled={actionLoading === check.id}
                    className="px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer"
                    style={{ background: '#ef444430', color: '#ef4444' }}>
                    Reject
                  </button>
                  <button onClick={() => handleReview(check.id, 'approve')}
                    disabled={actionLoading === check.id}
                    className="px-4 py-2 rounded-lg text-xs font-bold border-none cursor-pointer"
                    style={{ background: '#22c55e', color: '#fff' }}>
                    {actionLoading === check.id ? 'Processing…' : 'Approve → Consumer DB'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TAB 3: Enforcement Dashboard
// ─────────────────────────────────────────────────────────────────────────
function EnforcementDashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const perms = usePermissions();

  useEffect(() => {
    api.get('/enforcement/summary')
      .then(res => setData(res.data.data))
      .catch(err => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="card p-12 text-center" style={{ background: 'var(--color-garuda-800)' }}>
        <div className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Loading enforcement dashboard…</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Positive', value: data.allTime.positive, color: '#ef4444' },
    { name: 'Negative', value: data.allTime.negative, color: '#22c55e' },
  ].filter(d => d.value > 0);

  const monthlyChartData = (data.monthlyTrend || []).map(m => ({
    month: m.month,
    Positive: Number(m.positive),
    Negative: Number(m.negative),
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'This Month', value: data.thisMonth.total, color: '#3b82f6', icon: '📋' },
          { label: 'Positive (+ve)', value: data.thisMonth.positive, color: '#ef4444', icon: '⚠️' },
          { label: 'Negative (-ve)', value: data.thisMonth.negative, color: '#22c55e', icon: '✅' },
          { label: 'Pending Review', value: data.pendingReview, color: '#f59e0b', icon: '⏳' },
        ].map(kpi => (
          <div key={kpi.label} className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>{kpi.label}</span>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <div className="text-3xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Trend Bar Chart */}
        <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Monthly Enforcement Trend</h3>
          {monthlyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }} />
                <Bar dataKey="Positive" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Negative" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: 'var(--color-garuda-500)' }}>No data yet</div>
          )}
        </div>

        {/* Test Result Breakdown Pie */}
        <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Test Result Breakdown (All Time)</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="name" paddingAngle={4}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm" style={{ color: 'var(--color-garuda-500)' }}>No data yet</div>
          )}
        </div>
      </div>

      {/* Place of Enforcement Table */}
      {data.placeFrequency && data.placeFrequency.length > 0 && (
        <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Top Enforcement Locations</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>#</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Place</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Checks</th>
                </tr>
              </thead>
              <tbody>
                {data.placeFrequency.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                    <td className="py-2 px-3" style={{ color: 'var(--color-garuda-400)' }}>{i + 1}</td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-garuda-200)' }}>{p.place}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: 'var(--color-accent-400)' }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Station Breakdown (SP/ASP only) */}
      {data.stationBreakdown && data.stationBreakdown.length > 0 && (
        <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Station-wise Enforcement (This Month)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Station</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Total</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: '#ef4444' }}>+ve</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: '#22c55e' }}>-ve</th>
                </tr>
              </thead>
              <tbody>
                {data.stationBreakdown.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-garuda-200)' }}>{s.ps_name}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: 'var(--color-garuda-100)' }}>{Number(s.total)}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: '#ef4444' }}>{Number(s.positive)}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: '#22c55e' }}>{Number(s.negative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Checks Table */}
      {data.recentChecks && data.recentChecks.length > 0 && (
        <div className="p-5 rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--color-garuda-200)' }}>Recent Enforcement Checks</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Subject</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Place</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Station</th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Result</th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Status</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-garuda-500)' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentChecks.map((c) => {
                  const st = STATUS_COLORS[c.status] || STATUS_COLORS.FIELD_CREATED;
                  const rt = RESULT_COLORS[c.test_result] || RESULT_COLORS.PENDING;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                      <td className="py-2 px-3 font-medium flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
                        {c.photo_url ? (
                          <img src={c.photo_url} alt={c.subject_name} className="w-6 h-6 rounded-full object-cover border border-slate-700 flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>👤</div>
                        )}
                        <span>{c.subject_name}</span>
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--color-garuda-300)' }}>{c.place_of_enforcement}</td>
                      <td className="py-2 px-3" style={{ color: 'var(--color-garuda-300)' }}>{c.police_station?.name || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: rt.bg, color: rt.text }}>
                          {c.test_result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-garuda-400)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
