/**
 * GARUDA — Technical Surveillance Module (Page 5)
 * Route: /surveillance
 * Centralised intelligence gathering from mobile networks, IMEI data,
 * geo-location analysis, and social media monitoring.
 */
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../api/axios';
import {
  IconFieldStaff, IconSearch, IconMap, IconMegaphone, IconChain, IconSurveillance,
  IconLock, IconEdit, IconWarning, IconPlus, IconClipboard, IconArrowRight, IconRefresh
} from '../../components/Icons';

const TABS = [
  { id: 'mobile', label: 'Mobile Analysis', Icon: IconFieldStaff, color: '#3b82f6' },
  { id: 'imei', label: 'IMEI Tracking', Icon: IconSearch, color: '#8b5cf6' },
  { id: 'geo', label: 'Geo-Location', Icon: IconMap, color: '#059669' },
  { id: 'social', label: 'Social Media', Icon: IconMegaphone, color: '#ec4899' },
  { id: 'messaging', label: 'Messaging Intel', Icon: IconSurveillance, color: '#f59e0b' },
  { id: 'correlation', label: 'Correlation & Tower Dump', Icon: IconChain, color: '#6366f1' },
];

const PLATFORMS = ['Facebook', 'Instagram', 'Telegram', 'WhatsApp', 'X/Twitter', 'Signal', 'YouTube'];
const RATINGS = [
  { value: 'CONFIRMED', label: 'Confirmed', color: '#ef4444' },
  { value: 'PROBABLE', label: 'Probable', color: '#f59e0b' },
  { value: 'UNVERIFIED', label: 'Unverified', color: '#6b7280' },
];
const INTEL_SOURCES = [
  { value: 'INFORMER', label: 'Informer' },
  { value: 'TIP_OFF', label: 'Tip-off' },
  { value: 'INTERCEPT', label: 'Intercept' },
];

export default function Surveillance() {
  const [activeTab, setActiveTab] = useState('mobile');
  const perms = usePermissions();

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  // PII reveal state
  const [revealMobiles, setRevealMobiles] = useState(false);
  const [revealImeis, setRevealImeis] = useState(false);
  const [revealCorr, setRevealCorr] = useState(false);

  // Common offender search state for modal forms
  const [offenderQuery, setOffenderQuery] = useState('');
  const [offenderResults, setOffenderResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOffender, setSelectedOffender] = useState(null);

  // -------------------------------------------------------------
  // TAB 1: MOBILE ANALYSIS STATE
  // -------------------------------------------------------------
  const [mobiles, setMobiles] = useState([]);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileForm, setMobileForm] = useState({
    value: '',
    contactType: 'MOBILE_PRIMARY',
    notes: '',
  });

  // -------------------------------------------------------------
  // TAB 2: IMEI TRACKING STATE
  // -------------------------------------------------------------
  const [imeis, setImeis] = useState([]);
  const [expandedImeis, setExpandedImeis] = useState(new Set());
  const [showImeiModal, setShowImeiModal] = useState(false);
  const [imeiForm, setImeiForm] = useState({
    imeiNumber: '',
    deviceMake: '',
    deviceModel: '',
    simNumber: '',
    simProvider: '',
    mobileNumber: '',
    notes: '',
  });

  // -------------------------------------------------------------
  // TAB 3: GEO-LOCATION MAP STATE
  // -------------------------------------------------------------
  const [mapGeoJson, setMapGeoJson] = useState(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapFilters, setMapFilters] = useState({
    showCheckins: true,
    showTowers: true,
    minRisk: 0,
  });

  // -------------------------------------------------------------
  // TAB 4: SOCIAL MEDIA INTEL STATE
  // -------------------------------------------------------------
  const [socialLogs, setSocialLogs] = useState([]);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [socialForm, setSocialForm] = useState({
    platform: 'Facebook',
    handleOrUrl: '',
    rating: 'UNVERIFIED',
    notes: '',
  });

  // -------------------------------------------------------------
  // TAB 5: MESSAGING INTEL STATE
  // -------------------------------------------------------------
  const [messagingLogs, setMessagingLogs] = useState([]);
  const [showMessagingModal, setShowMessagingModal] = useState(false);
  const [messagingForm, setMessagingForm] = useState({
    platform: 'WhatsApp',
    sourceType: 'TIP_OFF',
    disposition: 'Active',
    inputText: '',
  });

  // -------------------------------------------------------------
  // TAB 6: CORRELATIONS & TOWER DUMP STATE
  // -------------------------------------------------------------
  const [correlations, setCorrelations] = useState(null);
  const [cases, setCases] = useState([]);
  const [towerFile, setTowerFile] = useState(null);
  const [towerCaseId, setTowerCaseId] = useState('');
  const [towerUploadResult, setTowerUploadResult] = useState(null);
  const [towerUploading, setTowerUploading] = useState(false);

  // Intersection Finder state
  const [intersectCaseIds, setIntersectCaseIds] = useState('');
  const [intersectionResult, setIntersectionResult] = useState(null);
  const [intersectionLoading, setIntersectionLoading] = useState(false);

  // -------------------------------------------------------------
  // LOADERS & ACTIONS
  // -------------------------------------------------------------
  const fetchDashboard = async () => {
    try {
      const res = await api.get('/surveillance/dashboard');
      setDashboardData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMobiles = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/surveillance/mobiles?reveal=${revealMobiles}&size=100`);
      setMobiles(res.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImeis = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/surveillance/imeis?reveal=${revealImeis}`);
      setImeis(res.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/surveillance/social');
      setSocialLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessagingLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/surveillance/messaging');
      setMessagingLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCorrelationsAndCases = async () => {
    setLoading(true);
    try {
      const [corrRes, casesRes] = await Promise.all([
        api.get(`/surveillance/correlations?reveal=${revealCorr}`),
        api.get('/cases?size=200'),
      ]);
      setCorrelations(corrRes.data.data);
      setCases(casesRes.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMapLogs = async () => {
    try {
      const res = await api.get('/surveillance/map-logs');
      setMapGeoJson(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'mobile') fetchMobiles();
    if (activeTab === 'imei') fetchImeis();
    if (activeTab === 'social') fetchSocialLogs();
    if (activeTab === 'messaging') fetchMessagingLogs();
    if (activeTab === 'correlation') fetchCorrelationsAndCases();
    if (activeTab === 'geo') fetchMapLogs();
  }, [activeTab, revealMobiles, revealImeis, revealCorr]);

  // Offender search query handler
  useEffect(() => {
    if (!offenderQuery.trim()) {
      setOffenderResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/offenders?query=${encodeURIComponent(offenderQuery)}&size=10`);
        setOffenderResults(res.data.data?.content || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [offenderQuery]);

  const resetOffenderSearch = () => {
    setOffenderQuery('');
    setOffenderResults([]);
    setSelectedOffender(null);
  };

  // -------------------------------------------------------------
  // LEAFLET MAP DYNAMIC INTEGRATION HOOK & INITIALIZER
  // -------------------------------------------------------------
  const [leafletReady, setLeafletReady] = useState(!!window.L);

  useEffect(() => {
    if (window.L) {
      setLeafletReady(true);
      return;
    }
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const scriptId = 'leaflet-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    }
  }, []);

  // Map Initializer
  useEffect(() => {
    if (activeTab !== 'geo' || !leafletReady || !mapGeoJson || !mapContainerRef.current) return;

    // Destroy existing map instance to avoid container reuse crashes
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default center Tirupati district coordinates
    const map = window.L.map(mapContainerRef.current).setView([13.6288, 79.4192], 12);
    mapInstanceRef.current = map;

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const checkinGroup = window.L.layerGroup();
    const towerGroup = window.L.layerGroup();

    mapGeoJson.features.forEach((feature) => {
      const { coordinates } = feature.geometry;
      const { kind, offenderName, cellTowerId, provider, mobile, hitTime, riskScore, date, status } = feature.properties;

      if (kind === 'checkin' && mapFilters.showCheckins) {
        if (riskScore >= mapFilters.minRisk) {
          const color = riskScore >= 75 ? '#dc2626' : riskScore >= 45 ? '#ea580c' : '#16a34a';
          const marker = window.L.circleMarker([coordinates[1], coordinates[0]], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          });
          marker.bindPopup(`
            <div class="p-1 text-slate-900">
              <h4 class="font-bold text-slate-800 text-sm">${offenderName || 'Suspect'}</h4>
              <p class="text-xs text-slate-500 mt-0.5">Check-in Status: <strong>${status}</strong></p>
              <p class="text-xs text-slate-500">Risk Score: <strong>${riskScore || '—'}/100</strong></p>
              <p class="text-xs text-slate-500 mt-1">Date: ${new Date(date).toLocaleDateString()}</p>
            </div>
          `);
          checkinGroup.addLayer(marker);
        }
      }

      if (kind === 'tower' && mapFilters.showTowers) {
        const marker = window.L.circleMarker([coordinates[1], coordinates[0]], {
          radius: 6,
          fillColor: '#8b5cf6',
          color: '#ffffff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.9,
        });

        // Radii circle overlay (e.g. 600m)
        const radiusCircle = window.L.circle([coordinates[1], coordinates[0]], {
          radius: 600,
          color: '#8b5cf6',
          fillColor: '#8b5cf6',
          fillOpacity: 0.08,
          weight: 1,
        });

        marker.bindPopup(`
          <div class="p-1 text-slate-900">
            <h4 class="font-bold text-slate-800 text-sm">Cell Tower: ${cellTowerId}</h4>
            <p class="text-xs text-slate-500">Provider: <strong>${provider || 'Unknown'}</strong></p>
            <p class="text-xs text-slate-500">Suspect Mobile: <strong>${mobile || '—'}</strong></p>
            <p class="text-xs text-slate-500 mt-1">Timestamp: ${new Date(hitTime).toLocaleString()}</p>
          </div>
        `);
        towerGroup.addLayer(marker);
        towerGroup.addLayer(radiusCircle);
      }
    });

    checkinGroup.addTo(map);
    towerGroup.addTo(map);

    // Auto-fit bounds if we have layers
    const allMarkers = [...checkinGroup.getLayers(), ...towerGroup.getLayers()].filter(l => typeof l.getLatLng === 'function');
    if (allMarkers.length > 0) {
      const bounds = window.L.featureGroup(allMarkers).getBounds();
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab, leafletReady, mapGeoJson, mapFilters]);

  // -------------------------------------------------------------
  // MUTATIONS (SUBMIT FORM LOGIC)
  // -------------------------------------------------------------
  const handleAddMobile = async (e) => {
    e.preventDefault();
    if (!selectedOffender || !mobileForm.value) {
      alert('Offender search and mobile number are required');
      return;
    }
    try {
      await api.post('/surveillance/mobile', {
        offenderId: selectedOffender.id,
        ...mobileForm,
      });
      alert('Mobile number link added to offender successfully!');
      setShowMobileModal(false);
      setMobileForm({ value: '', contactType: 'MOBILE_PRIMARY', notes: '' });
      resetOffenderSearch();
      fetchMobiles();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add mobile tracking record');
    }
  };

  const handleAddImei = async (e) => {
    e.preventDefault();
    if (!selectedOffender || !imeiForm.imeiNumber) {
      alert('Offender search and IMEI number are required');
      return;
    }
    try {
      const res = await api.post('/surveillance/imei', {
        offenderId: selectedOffender.id,
        ...imeiForm,
      });
      if (res.data.data?.simSwapDetected) {
        alert('⚠️ SIM SWAP DETECTED: Added IMEI record. Sim swap conflict has been flagged!');
      } else {
        alert('IMEI tracking record logged successfully!');
      }
      setShowImeiModal(false);
      setImeiForm({
        imeiNumber: '',
        deviceMake: '',
        deviceModel: '',
        simNumber: '',
        simProvider: '',
        mobileNumber: '',
        notes: '',
      });
      resetOffenderSearch();
      fetchImeis();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add IMEI record');
    }
  };

  const handleAddSocial = async (e) => {
    e.preventDefault();
    if (!selectedOffender || !socialForm.handleOrUrl) {
      alert('Offender and handle/URL are required');
      return;
    }
    try {
      await api.post('/surveillance/social', {
        offenderId: selectedOffender.id,
        ...socialForm,
      });
      alert('Social media intelligence input logged!');
      setShowSocialModal(false);
      setSocialForm({ platform: 'Facebook', handleOrUrl: '', rating: 'UNVERIFIED', notes: '' });
      resetOffenderSearch();
      fetchSocialLogs();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to log social intelligence');
    }
  };

  const handleAddMessaging = async (e) => {
    e.preventDefault();
    if (!selectedOffender || !messagingForm.inputText) {
      alert('Offender and intelligence input notes are required');
      return;
    }
    try {
      await api.post('/surveillance/messaging', {
        offenderId: selectedOffender.id,
        ...messagingForm,
      });
      alert('Messaging intercept logged!');
      setShowMessagingModal(false);
      setMessagingForm({ platform: 'WhatsApp', sourceType: 'TIP_OFF', disposition: 'Active', inputText: '' });
      resetOffenderSearch();
      fetchMessagingLogs();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to log messaging intercept');
    }
  };

  const handleTowerDumpSubmit = async (e) => {
    e.preventDefault();
    if (!towerCaseId || !towerFile) {
      alert('Case selection and data file are required');
      return;
    }
    const fd = new FormData();
    fd.append('file', towerFile);
    fd.append('caseId', towerCaseId);
    setTowerUploading(true);

    try {
      const res = await api.post('/surveillance/tower-dump', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTowerUploadResult(res.data.data);
      alert(`Tower dump ingestion complete! Ingested ${res.data.data.inserted} log records.`);
      setTowerFile(null);
      fetchCorrelationsAndCases();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to ingest tower dump file');
    } finally {
      setTowerUploading(false);
    }
  };

  const handleFindIntersections = async (e) => {
    e.preventDefault();
    if (!intersectCaseIds.trim()) {
      alert('Enter at least two case IDs (comma-separated)');
      return;
    }
    setIntersectionLoading(true);
    try {
      const res = await api.get(`/surveillance/tower-intersections?caseIds=${intersectCaseIds}`);
      setIntersectionResult(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch tower overlaps');
    } finally {
      setIntersectionLoading(false);
    }
  };

  const toggleImeiExpand = (imeiNum) => {
    const next = new Set(expandedImeis);
    if (next.has(imeiNum)) next.delete(imeiNum);
    else next.add(imeiNum);
    setExpandedImeis(next);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Technical Surveillance & Cyber Cell
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Track suspect mobiles, audit SIM Swaps, parse cell tower logs, and overlay cross-case correlations.
          </p>
        </div>

        {/* Dashboard Quick Stats */}
        {dashboardData && (
          <div className="flex gap-4">
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">Tracked Mobiles</span>
              <span className="text-xl font-bold text-blue-500">{dashboardData.kpis?.trackedMobiles || 0}</span>
            </div>
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">SIM Swaps</span>
              <span className="text-xl font-bold text-amber-500">{dashboardData.kpis?.simSwaps || 0}</span>
            </div>
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">Cross Matches</span>
              <span className="text-xl font-bold text-red-500">
                {(dashboardData.kpis?.crossCaseMobiles || 0) + (dashboardData.kpis?.crossCaseImeis || 0)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Selector Bar */}
      <div className="flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--color-garuda-700)', paddingBottom: '0.75rem' }}>
        {TABS.map(tab => (
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

      {/* Main Content Area */}
      <div className="card rounded-xl p-6 border border-slate-100/50 dark:border-slate-800" style={{ background: 'var(--color-garuda-800)' }}>
        
        {/* ── MOBILE ANALYSIS TAB ── */}
        {activeTab === 'mobile' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Suspect Mobile Number Tracker</h2>
                <p className="text-xs text-garuda-400">Register and monitor primary/secondary mobile contacts linked to drug traffickers.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setRevealMobiles(!revealMobiles)}
                  className="btn btn-sm btn-secondary flex items-center gap-1"
                >
                  <IconLock size={14} />
                  <span>{revealMobiles ? 'Mask Numbers' : 'Reveal Raw PII'}</span>
                </button>
                {perms.hasPermission('TECH_ADD') && (
                  <button
                    onClick={() => setShowMobileModal(true)}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    <IconPlus size={14} />
                    <span>Track Mobile Number</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Loading tracking lists...</div>
            ) : mobiles.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                No mobile numbers currently under tracker. Click "Track Mobile Number" to add.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="table-header" style={{ background: 'var(--color-garuda-600)' }}>
                      <th className="p-3 font-semibold text-garuda-200">Suspect Accused</th>
                      <th className="p-3 font-semibold text-garuda-200">Mobile Number</th>
                      <th className="p-3 font-semibold text-garuda-200">Tag / Usage Type</th>
                      <th className="p-3 font-semibold text-garuda-200">Notes / Provider</th>
                      <th className="p-3 font-semibold text-garuda-200">Linked Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mobiles.map((m) => (
                      <tr key={m.id} className="border-b border-garuda-700 hover:bg-garuda-600/30">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {m.offenderPhoto ? (
                              <img src={m.offenderPhoto} className="w-8 h-8 rounded-full object-cover border border-garuda-500" alt="Offender" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-garuda-200">
                                {m.offenderName?.charAt(0) || 'S'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-garuda-100">{m.offenderName}</div>
                              {m.offenderAlias && <span className="text-xs text-garuda-400">Alias: {m.offenderAlias}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-garuda-55">{m.value}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {m.contactType}
                          </span>
                        </td>
                        <td className="p-3 text-garuda-300">{m.notes || '—'}</td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-0.5 bg-garuda-700 rounded text-garuda-300">
                            Risk Level: {m.riskScore ? `${m.riskScore}/100` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── IMEI TRACKING TAB ── */}
        {activeTab === 'imei' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">IMEI Device & Hardware Register</h2>
                <p className="text-xs text-garuda-400">Track device IMEI keys, link SIM cards, and flag active SIM Swapping events.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setRevealImeis(!revealImeis)}
                  className="btn btn-sm btn-secondary flex items-center gap-1"
                >
                  <IconLock size={14} />
                  <span>{revealImeis ? 'Mask IMEIs' : 'Reveal Raw PII'}</span>
                </button>
                {perms.hasPermission('TECH_ADD') && (
                  <button
                    onClick={() => setShowImeiModal(true)}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    <IconPlus size={14} />
                    <span>Track IMEI Record</span>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Loading IMEI logs...</div>
            ) : imeis.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                No IMEIs logged under tracker. Click "Track IMEI Record" to add.
              </div>
            ) : (
              <div className="space-y-4">
                {imeis.map((item) => {
                  const isExpanded = expandedImeis.has(item.imei);
                  const isSwapped = item.status === 'SWAPPED' || item.hasSwapHistory;
                  return (
                    <div key={item.id} className="border border-garuda-700 rounded-xl bg-garuda-900/40 overflow-hidden shadow-card">
                      <div 
                        onClick={() => toggleImeiExpand(item.imei)}
                        className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-garuda-600/10 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-lg ${isSwapped ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                            <IconSearch size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-garuda-50">IMEI: {item.imei}</span>
                              {isSwapped && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-bold animate-pulse">
                                  SIM SWAP DETECTED
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-garuda-400 mt-0.5">
                              Device: <strong className="text-garuda-200">{item.deviceMake || 'Unknown'} {item.deviceModel || '—'}</strong> | Suspect: <strong className="text-garuda-200">{item.offenderName}</strong>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-garuda-400">
                          <div>
                            <div>Sim Network</div>
                            <div className="text-sm font-semibold text-garuda-200 mt-0.5">{item.simProvider || '—'}</div>
                          </div>
                          <div>
                            <div>Linked Phone</div>
                            <div className="text-sm font-mono font-bold text-garuda-200 mt-0.5">{item.mobile || '—'}</div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'ACTIVE' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                              {item.status}
                            </span>
                            <div className="mt-1 text-[10px]">First seen: {new Date(item.firstSeen).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable SIM Swap history panel */}
                      {isExpanded && (
                        <div className="bg-garuda-800/40 border-t border-garuda-700 p-4 space-y-3">
                          <h4 className="text-xs font-bold text-garuda-300 uppercase tracking-wider">Device Association History (SIM Logs)</h4>
                          {item.swapHistory && item.swapHistory.length > 0 ? (
                            <div className="relative pl-6 border-l-2 border-purple-500/30 space-y-4 py-2">
                              {item.swapHistory.map((swap, index) => (
                                <div key={index} className="relative">
                                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-purple-500 border-4 border-garuda-800 flex items-center justify-center" />
                                  <div className="text-xs text-garuda-400">
                                    <span className="font-bold text-garuda-200">{swap.mobile}</span> ({swap.simProvider || 'Unknown Provider'})
                                  </div>
                                  <div className="text-[10px] text-garuda-500 mt-0.5">
                                    Time span: {new Date(swap.firstSeen).toLocaleString()} to {swap.lastSeen ? new Date(swap.lastSeen).toLocaleString() : 'Present'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-garuda-400">No SIM swap timeline records logged for this IMEI key.</p>
                          )}
                          {item.notes && (
                            <div className="mt-3 p-2 bg-garuda-700/30 rounded border border-garuda-700 text-xs text-garuda-300">
                              <strong>Notes:</strong> {item.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── GEO-LOCATION MAP TAB ── */}
        {activeTab === 'geo' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Hotspot Mapping & Coverage GIS</h2>
                <p className="text-xs text-garuda-400">Plot check-in coordinates and tower intersections to map contraband transport trails.</p>
              </div>
              <button 
                onClick={fetchMapLogs}
                className="btn btn-sm btn-secondary flex items-center gap-1.5"
              >
                <IconRefresh size={14} />
                <span>Reload Coordinates</span>
              </button>
            </div>

            {/* Map Dashboard Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-garuda-900/50 border border-garuda-700">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="filter-checkins" 
                  checked={mapFilters.showCheckins}
                  onChange={e => setMapFilters({ ...mapFilters, showCheckins: e.target.checked })}
                  className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <label htmlFor="filter-checkins" className="text-xs font-semibold text-garuda-300">Show GPS Check-ins</label>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="filter-towers" 
                  checked={mapFilters.showTowers}
                  onChange={e => setMapFilters({ ...mapFilters, showTowers: e.target.checked })}
                  className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <label htmlFor="filter-towers" className="text-xs font-semibold text-garuda-300">Show Cell Towers</label>
              </div>

              <div className="col-span-2 flex items-center gap-3">
                <span className="text-xs font-semibold text-garuda-300 whitespace-nowrap">Min Offender Risk:</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="10"
                  value={mapFilters.minRisk}
                  onChange={e => setMapFilters({ ...mapFilters, minRisk: parseInt(e.target.value) })}
                  className="w-full accent-orange-500"
                />
                <span className="text-xs font-bold text-orange-500 font-mono w-8 text-right">{mapFilters.minRisk}+</span>
              </div>
            </div>

            {/* Leaflet map container */}
            <div 
              id="surveillance-map" 
              ref={mapContainerRef} 
              className="w-full rounded-xl border border-garuda-700 shadow-elevated overflow-hidden" 
              style={{ height: '500px', background: '#e5e7eb' }}
            />
          </div>
        )}

        {/* ── SOCIAL MEDIA INTEL TAB ── */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Social Media Monitor</h2>
                <p className="text-xs text-garuda-400">Log suspect handles and URLs from messaging platforms or community channels.</p>
              </div>
              {perms.hasPermission('TECH_ADD') && (
                <button
                  onClick={() => setShowSocialModal(true)}
                  className="btn btn-sm btn-primary flex items-center gap-1"
                >
                  <IconPlus size={14} />
                  <span>Log Social Intel</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Loading social logs...</div>
            ) : socialLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                No social media intelligence records currently logged.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {socialLogs.map((log) => {
                  const ratingObj = RATINGS.find(r => r.value === log.rating) || RATINGS[2];
                  return (
                    <div key={log.id} className="card p-4 border border-garuda-700/60 rounded-xl bg-garuda-900/30 flex justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded font-bold uppercase" style={{ background: ratingObj.color + '18', color: ratingObj.color }}>
                            {ratingObj.label}
                          </span>
                          <span className="text-xs font-semibold text-blue-400">{log.platform}</span>
                        </div>
                        <div>
                          <strong className="text-sm text-garuda-100">{log.handleOrUrl}</strong>
                          <div className="text-xs text-garuda-400 mt-1">Linked Suspect: <strong className="text-garuda-300">{log.offenderName}</strong></div>
                        </div>
                        {log.notes && <p className="text-xs text-garuda-300 italic">"{log.notes}"</p>}
                      </div>
                      <div className="text-right text-[10px] text-garuda-500 whitespace-nowrap self-end">
                        Logged by: {log.createdByName}<br />
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGING INTEL TAB ── */}
        {activeTab === 'messaging' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Encrypted Messaging Intercepts</h2>
                <p className="text-xs text-garuda-400">Record intelligence findings from Telegram groups, WhatsApp broadcasts, or Signal channels.</p>
              </div>
              {perms.hasPermission('TECH_ADD') && (
                <button
                  onClick={() => setShowMessagingModal(true)}
                  className="btn btn-sm btn-primary flex items-center gap-1"
                >
                  <IconPlus size={14} />
                  <span>Log Intercept Info</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Loading messaging logs...</div>
            ) : messagingLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                No messaging intercepts logged.
              </div>
            ) : (
              <div className="space-y-4">
                {messagingLogs.map((log) => (
                  <div key={log.id} className="card p-4 border border-garuda-700/60 rounded-xl bg-garuda-900/30 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {log.sourceType}
                        </span>
                        <span className="text-xs font-bold text-purple-400">{log.platform}</span>
                        <span className="text-xs text-garuda-400">Suspect: <strong className="text-garuda-200">{log.offenderName}</strong></span>
                      </div>
                      <div className="text-[10px] text-garuda-400">
                        {new Date(log.createdAt).toLocaleString()} | Operator: {log.createdByName}
                      </div>
                    </div>
                    <div className="p-3 bg-garuda-900/50 rounded-lg border border-garuda-800 text-sm text-garuda-200 font-mono leading-relaxed whitespace-pre-wrap">
                      {log.inputText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CORRELATION & TOWER DUMP TAB ── */}
        {activeTab === 'correlation' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Tower Ingestion Upload form */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-bold text-garuda-100 flex items-center gap-2">
                    <IconPlus color="#3b82f6" size={18} />
                    <span>Ingest CDR / Cell Tower Logs</span>
                  </h3>
                  <p className="text-xs text-garuda-400 mt-1">Upload CSV or XLSX tower dump dumps to automatically check intersection targets.</p>
                </div>

                <form onSubmit={handleTowerDumpSubmit} className="space-y-4 p-4 rounded-xl bg-garuda-900/40 border border-garuda-700/60">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-garuda-200">Associate with Case (FIR) *</label>
                    <select
                      value={towerCaseId}
                      onChange={e => setTowerCaseId(e.target.value)}
                      className="select"
                      required
                    >
                      <option value="">— Select Active Case —</option>
                      {cases.map(c => <option key={c.id} value={c.id}>{c.firNo} ({c.police_stations?.name || 'Excise'})</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-garuda-200">Upload Data File (CSV / XLSX) *</label>
                    <input 
                      type="file" 
                      accept=".csv, .xlsx, .xls"
                      onChange={e => setTowerFile(e.target.files[0])}
                      className="input py-2 text-xs"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={towerUploading}
                    className="btn btn-primary w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-2"
                  >
                    {towerUploading ? 'Processing File...' : 'Upload & Run Intersection check'}
                  </button>
                </form>

                {towerUploadResult && (
                  <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-xs space-y-2">
                    <h4 className="font-bold text-green-400">Ingestion Summary</h4>
                    <ul className="list-disc pl-4 text-garuda-300 space-y-1">
                      <li>Ingested records: <strong>{towerUploadResult.inserted}</strong></li>
                      <li>Matched Headers: <strong>{towerUploadResult.detectedColumns?.join(', ') || '—'}</strong></li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Right Column: Tower Overlap Intersection finder */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-bold text-garuda-100 flex items-center gap-2">
                    <IconChain color="#f59e0b" size={18} />
                    <span>Tower Dump Intersection Engine</span>
                  </h3>
                  <p className="text-xs text-garuda-400 mt-1">Cross-compare two or more cases to extract mobile numbers registered at multiple scenes.</p>
                </div>

                <form onSubmit={handleFindIntersections} className="space-y-4 p-4 rounded-xl bg-garuda-900/40 border border-garuda-700/60">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-garuda-200">Enter Case IDs (Comma Separated) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 1, 3, 4"
                      value={intersectCaseIds}
                      onChange={e => setIntersectCaseIds(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={intersectionLoading}
                    className="btn btn-secondary w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-2"
                  >
                    {intersectionLoading ? 'Running Set Intersection...' : 'Search Shared Devices'}
                  </button>
                </form>

                {intersectionResult && (
                  <div className="p-4 rounded-xl bg-garuda-900/60 border border-garuda-700 space-y-3">
                    <h4 className="font-bold text-garuda-200 text-xs">Overlap Results ({intersectionResult.total} devices)</h4>
                    {intersectionResult.intersections && intersectionResult.intersections.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {intersectionResult.intersections.map((match, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded bg-garuda-800 border border-garuda-700 text-xs">
                            <span className="font-mono font-bold text-garuda-50">{match.mobile_number}</span>
                            <span className="text-garuda-400">Total Scene Hits: <strong className="text-garuda-200">{match.hitCount || match.count || 2}</strong></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-garuda-400">No overlapping mobile devices found in selected case portfolios.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Panel: Cross-Case Intelligence Alerts Feed */}
            <div className="space-y-4 border-t border-garuda-700 pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-md font-bold text-garuda-100">Cross-Case Correlation Feed</h3>
                  <p className="text-xs text-garuda-400 mt-0.5">Automated detection of shared numbers or hardware keys appearing across different cases.</p>
                </div>
                <button
                  onClick={() => setRevealCorr(!revealCorr)}
                  className="btn btn-sm btn-secondary flex items-center gap-1.5"
                >
                  <IconLock size={12} />
                  <span>{revealCorr ? 'Mask Log Numbers' : 'Reveal Log PII'}</span>
                </button>
              </div>

              {loading ? (
                <div className="text-center py-6 text-garuda-400">Comparing datasets...</div>
              ) : !correlations || (correlations.duplicateMobiles.length === 0 && correlations.duplicateImeis.length === 0) ? (
                <div className="text-center py-8 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                  No cross-case hardware or mobile overlaps detected currently.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Mobiles overlap feed */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">🔴 Shared Mobile Contacts ({correlations.duplicateMobiles.length})</h4>
                    <div className="space-y-3">
                      {correlations.duplicateMobiles.map((m, idx) => (
                        <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-red-400 text-sm">{m.mobile}</span>
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold">
                              {m.caseCount} Cases
                            </span>
                          </div>
                          <div className="space-y-1 pl-2 border-l border-red-500/30">
                            {m.cases?.map((c, i) => (
                              <div key={i} className="text-garuda-400">
                                Case FIR: <strong className="text-garuda-200">{c.firNo}</strong> | Station: {c.psName || 'Excise'}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* IMEIs overlap feed */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">🔴 Shared Device IMEIs ({correlations.duplicateImeis.length})</h4>
                    <div className="space-y-3">
                      {correlations.duplicateImeis.map((i, idx) => (
                        <div key={idx} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-red-400 text-sm">IMEI: {i.imei}</span>
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold">
                              {i.offenderCount} Suspects
                            </span>
                          </div>
                          <div className="space-y-1 pl-2 border-l border-red-500/30">
                            {i.offenders?.map((o, k) => (
                              <div key={k} className="text-garuda-400">
                                Accused: <strong className="text-garuda-200">{o.name}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── MODALS SECTION ── */}
      
      {/* 1. Track Mobile Modal */}
      {showMobileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-garuda-800 border border-garuda-700 rounded-xl max-w-lg w-full p-6 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-garuda-100">Add Mobile Number to Tracker</h3>
              <button onClick={() => { setShowMobileModal(false); resetOffenderSearch(); }} className="text-garuda-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddMobile} className="space-y-4">
              {/* Offender Autocomplete Search */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Search Suspect Accused *</label>
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white">
                    <span className="font-bold">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type suspect name..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-xs text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedOffender(o)}
                            className="p-2 text-xs text-garuda-200 hover:bg-garuda-600 cursor-pointer border-b border-garuda-800"
                          >
                            {o.full_name} ({o.alias || 'No Alias'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Mobile Number (10 digits) *</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={mobileForm.value}
                  onChange={e => setMobileForm({ ...mobileForm, value: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Link Type / Usage tag</label>
                <select
                  value={mobileForm.contactType}
                  onChange={e => setMobileForm({ ...mobileForm, contactType: e.target.value })}
                  className="select"
                >
                  <option value="MOBILE_PRIMARY">Primary Device</option>
                  <option value="MOBILE_SECONDARY">Secondary Device</option>
                  <option value="MOBILE_SIBLING">Relative/Sibling Device</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Investigation Notes (Network Provider, status etc.)</label>
                <textarea
                  rows="3"
                  placeholder="Details..."
                  value={mobileForm.notes}
                  onChange={e => setMobileForm({ ...mobileForm, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowMobileModal(false); resetOffenderSearch(); }} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Add Tracker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Track IMEI Modal */}
      {showImeiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-garuda-800 border border-garuda-700 rounded-xl max-w-lg w-full p-6 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-garuda-100">Log IMEI Device Sheet</h3>
              <button onClick={() => { setShowImeiModal(false); resetOffenderSearch(); }} className="text-garuda-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddImei} className="space-y-3">
              {/* Offender Autocomplete Search */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Search Suspect Accused *</label>
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white">
                    <span className="font-bold">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type suspect name..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-xs text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedOffender(o)}
                            className="p-2 text-xs text-garuda-200 hover:bg-garuda-600 cursor-pointer border-b border-garuda-800"
                          >
                            {o.full_name} ({o.alias || 'No Alias'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">IMEI Key Number *</label>
                  <input
                    type="text"
                    placeholder="15-digit code"
                    value={imeiForm.imeiNumber}
                    onChange={e => setImeiForm({ ...imeiForm, imeiNumber: e.target.value })}
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">SIM Number / IMSI</label>
                  <input
                    type="text"
                    placeholder="SIM card code"
                    value={imeiForm.simNumber}
                    onChange={e => setImeiForm({ ...imeiForm, simNumber: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Device Make</label>
                  <input
                    type="text"
                    placeholder="e.g. Samsung"
                    value={imeiForm.deviceMake}
                    onChange={e => setImeiForm({ ...imeiForm, deviceMake: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Device Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Galaxy S21"
                    value={imeiForm.deviceModel}
                    onChange={e => setImeiForm({ ...imeiForm, deviceModel: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Jio / Airtel"
                    value={imeiForm.simProvider}
                    onChange={e => setImeiForm({ ...imeiForm, simProvider: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Active Mobile</label>
                  <input
                    type="text"
                    placeholder="Linked mobile"
                    value={imeiForm.mobileNumber}
                    onChange={e => setImeiForm({ ...imeiForm, mobileNumber: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Investigation Notes</label>
                <textarea
                  rows="2"
                  placeholder="Details..."
                  value={imeiForm.notes}
                  onChange={e => setImeiForm({ ...imeiForm, notes: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowImeiModal(false); resetOffenderSearch(); }} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Add IMEI Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Log Social Media Intel Modal */}
      {showSocialModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-garuda-800 border border-garuda-700 rounded-xl max-w-lg w-full p-6 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-garuda-100">Log Social Media Intel</h3>
              <button onClick={() => { setShowSocialModal(false); resetOffenderSearch(); }} className="text-garuda-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddSocial} className="space-y-4">
              {/* Offender Autocomplete Search */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Search Suspect Accused *</label>
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white">
                    <span className="font-bold">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type suspect name..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-xs text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedOffender(o)}
                            className="p-2 text-xs text-garuda-200 hover:bg-garuda-600 cursor-pointer border-b border-garuda-800"
                          >
                            {o.full_name} ({o.alias || 'No Alias'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Platform *</label>
                  <select
                    value={socialForm.platform}
                    onChange={e => setSocialForm({ ...socialForm, platform: e.target.value })}
                    className="select"
                    required
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Intel Verification Rating</label>
                  <select
                    value={socialForm.rating}
                    onChange={e => setSocialForm({ ...socialForm, rating: e.target.value })}
                    className="select"
                  >
                    {RATINGS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Profile Handle or URL *</label>
                <input
                  type="text"
                  placeholder="e.g. @trafficker_id or t.me/channel"
                  value={socialForm.handleOrUrl}
                  onChange={e => setSocialForm({ ...socialForm, handleOrUrl: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Log Findings & Observation Notes</label>
                <textarea
                  rows="3"
                  placeholder="Details..."
                  value={socialForm.notes}
                  onChange={e => setSocialForm({ ...socialForm, notes: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowSocialModal(false); resetOffenderSearch(); }} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Log Intel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Log Messaging Intel Modal */}
      {showMessagingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-garuda-800 border border-garuda-700 rounded-xl max-w-lg w-full p-6 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-garuda-100">Log Messaging Platform Intercept</h3>
              <button onClick={() => { setShowMessagingModal(false); resetOffenderSearch(); }} className="text-garuda-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddMessaging} className="space-y-4">
              {/* Offender Autocomplete Search */}
              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Search Suspect Accused *</label>
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white">
                    <span className="font-bold">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type suspect name..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-xs text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => setSelectedOffender(o)}
                            className="p-2 text-xs text-garuda-200 hover:bg-garuda-600 cursor-pointer border-b border-garuda-800"
                          >
                            {o.full_name} ({o.alias || 'No Alias'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Platform *</label>
                  <select
                    value={messagingForm.platform}
                    onChange={e => setMessagingForm({ ...messagingForm, platform: e.target.value })}
                    className="select"
                    required
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Telegram">Telegram</option>
                    <option value="Signal">Signal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-garuda-200">Source Type</label>
                  <select
                    value={messagingForm.sourceType}
                    onChange={e => setMessagingForm({ ...messagingForm, sourceType: e.target.value })}
                    className="select"
                  >
                    {INTEL_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Disposition Status</label>
                <input
                  type="text"
                  placeholder="e.g. Active, Monitoring, Closed"
                  value={messagingForm.disposition}
                  onChange={e => setMessagingForm({ ...messagingForm, disposition: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Intercept / Chat transcript content *</label>
                <textarea
                  rows="4"
                  placeholder="Input text..."
                  value={messagingForm.inputText}
                  onChange={e => setMessagingForm({ ...messagingForm, inputText: e.target.value })}
                  className="input font-mono text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowMessagingModal(false); resetOffenderSearch(); }} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Save Message Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
