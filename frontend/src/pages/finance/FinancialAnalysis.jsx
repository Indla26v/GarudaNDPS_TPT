/**
 * GARUDA — Financial Analysis Module (Page 6)
 * Route: /finance
 * Track money flow in NDPS networks — financiers, suspicious transactions, UPI/hawala trails.
 */
import { useState, useEffect, useRef } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../api/axios';
import {
  IconFinance, IconDollar, IconBuilding, IconNetwork, IconFieldStaff, IconPackage,
  IconLock, IconPlus, IconClipboard, IconRefresh, IconArrowRight, IconWarning, IconSearch
} from '../../components/Icons';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const TABS = [
  { id: 'upload', label: 'Upload & Manage', Icon: IconClipboard, color: '#3b82f6' },
  { id: 'dashboard', label: 'Dashboard', Icon: IconFinance, color: '#22c55e' },
  { id: 'explorer', label: 'Transaction Explorer', Icon: IconDollar, color: '#8b5cf6' },
  { id: 'flow', label: 'Money Flow Map', Icon: IconNetwork, color: '#ec4899' },
  { id: 'profile', label: 'Financial Profiles', Icon: IconBuilding, color: '#f59e0b' },
];

export default function FinancialAnalysis() {
  const [activeTab, setActiveTab] = useState('upload');
  const perms = usePermissions();

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);

  // Common offender search state for forms
  const [offenderQuery, setOffenderQuery] = useState('');
  const [offenderResults, setOffenderResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedOffender, setSelectedOffender] = useState(null);

  // PII reveal state
  const [revealAccounts, setRevealAccounts] = useState(false);

  // -------------------------------------------------------------
  // TAB 1: UPLOAD & MANAGE STATE
  // -------------------------------------------------------------
  const [batches, setBatches] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    statementMonth: '',
    bankName: '',
    accountNo: '',
    upiId: '',
    preview: false,
  });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);

  // -------------------------------------------------------------
  // TAB 2: DASHBOARD ALERTS FEED & TRENDS
  // -------------------------------------------------------------
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);

  // -------------------------------------------------------------
  // TAB 3: TRANSACTION EXPLORER STATE
  // -------------------------------------------------------------
  const [transactions, setTransactions] = useState([]);
  const [txTotalElements, setTxTotalElements] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(0);
  const [explorerFilters, setExplorerFilters] = useState({
    offenderId: '',
    direction: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    flaggedOnly: false,
    matchedOnly: false,
  });

  // Transaction notes modal
  const [activeTxn, setActiveTxn] = useState(null);
  const [txnNotesVal, setTxnNotesVal] = useState('');
  const [txnFlaggedVal, setTxnFlaggedVal] = useState(false);
  const [saveNotesLoading, setSaveNotesLoading] = useState(false);

  // -------------------------------------------------------------
  // TAB 4: MONEY FLOW GRAPH STATE (CANVAS LAYOUT)
  // -------------------------------------------------------------
  const [flowCenterId, setFlowCenterId] = useState('');
  const [flowGraphData, setFlowGraphData] = useState(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Simulation variables
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const dragNodeRef = useRef(null);
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const isDraggingBackground = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  const [selectedEdgeDetails, setSelectedEdgeDetails] = useState(null);

  // -------------------------------------------------------------
  // TAB 5: FINANCIAL PROFILE STATE
  // -------------------------------------------------------------
  const [profileOffenderId, setProfileOffenderId] = useState('');
  const [profileData, setProfileData] = useState(null);

  // -------------------------------------------------------------
  // LOADERS & API CALLS
  // -------------------------------------------------------------
  const fetchDashboard = async () => {
    try {
      const res = await api.get('/finance/dashboard');
      setDashboardData(res.data.data);
      setRecentAlerts(res.data.data?.recentAlerts || []);
      setMonthlyTrend(res.data.data?.monthlyTrend || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/uploads?size=50');
      setBatches(res.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(txPage),
        size: '20',
        reveal: String(revealAccounts),
      });
      Object.entries(explorerFilters).forEach(([key, val]) => {
        if (val !== '' && val !== null && val !== false) {
          queryParams.append(key, String(val));
        }
      });

      const res = await api.get(`/finance/transactions?${queryParams.toString()}`);
      setTransactions(res.data.data?.content || []);
      setTxTotalElements(res.data.data?.totalElements || 0);
      setTxTotalPages(res.data.data?.totalPages || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlowMap = async (offId) => {
    if (!offId) return;
    setLoading(true);
    try {
      const res = await api.get(`/finance/flow-map/${offId}`);
      const data = res.data.data;
      setFlowGraphData(data);
      
      // Reset layout configurations
      setSelectedNodeDetails(null);
      setSelectedEdgeDetails(null);
      transformRef.current = { zoom: 1, panX: 0, panY: 0 };

      // Initialize positions in circle layout
      const width = 800;
      const height = 450;
      const nodes = (data.nodes || []).map((n, idx) => {
        const angle = (idx / Math.max(1, data.nodes.length - 1)) * Math.PI * 2;
        const radius = n.isCenter ? 0 : 150 + Math.random() * 50;
        return {
          ...n,
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          radius: n.isCenter ? 24 : n.type === 'offender' ? 18 : 14,
        };
      });

      nodesRef.current = nodes;
      edgesRef.current = data.edges || [];
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate money flow map');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async (offId) => {
    if (!offId) return;
    setLoading(true);
    try {
      const res = await api.get(`/finance/analysis/monthly/${offId}`);
      setProfileData(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load offender profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'upload') fetchBatches();
    if (activeTab === 'explorer') fetchTransactions();
  }, [activeTab, txPage, revealAccounts]);

  // Debounced search query for offender inputs
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
  // INTERACTIVE MONEY FLOW CANVAS ENGINE (60FPS ANIMATION LOOP)
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'flow' || !flowGraphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const updatePhysicsAndDraw = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const transform = transformRef.current;

      const width = canvas.width;
      const height = canvas.height;

      // ── Physics update ticks ──
      const kAttract = 0.04;
      const kRepel = 1200;
      const kGravity = 0.02;
      const damping = 0.85;

      // Center offender coordinates
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 300) {
            const force = kRepel / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!n1.isCenter && dragNodeRef.current !== n1) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (!n2.isCenter && dragNodeRef.current !== n2) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // 2. Attraction along edges
      edges.forEach((e) => {
        const nSource = nodes.find((n) => n.id === e.source);
        const nTarget = nodes.find((n) => n.id === e.target);
        if (nSource && nTarget) {
          const dx = nTarget.x - nSource.x;
          const dy = nTarget.y - nSource.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 120; // optimal spring length
          const force = (dist - targetDist) * kAttract;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!nSource.isCenter && dragNodeRef.current !== nSource) {
            nSource.vx += fx;
            nSource.vy += fy;
          }
          if (!nTarget.isCenter && dragNodeRef.current !== nTarget) {
            nTarget.vx -= fx;
            nTarget.vy -= fy;
          }
        }
      });

      // 3. Gravity pulling toward center
      nodes.forEach((n) => {
        if (!n.isCenter && dragNodeRef.current !== n) {
          const dx = centerX - n.x;
          const dy = centerY - n.y;
          n.vx += dx * kGravity;
          n.vy += dy * kGravity;
        }
      });

      // 4. Update coordinates
      nodes.forEach((n) => {
        if (dragNodeRef.current === n) {
          // Keep node pinned to pointer position
          const worldPointer = screenToWorld(mousePosRef.current.x, mousePosRef.current.y);
          n.x = worldPointer.x;
          n.y = worldPointer.y;
          n.vx = 0;
          n.vy = 0;
        } else {
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= damping;
          n.vy *= damping;
        }

        // Bound nodes to sanity sizes
        n.x = Math.max(50, Math.min(width - 50, n.x));
        n.y = Math.max(50, Math.min(height - 50, n.y));
      });

      // ── Rendering loop ──
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      
      // Apply zoom & pan transforms
      ctx.translate(transform.panX, transform.panY);
      ctx.scale(transform.zoom, transform.zoom);

      // Draw Edges (Transaction lines)
      edges.forEach((e) => {
        const nSource = nodes.find((n) => n.id === e.source);
        const nTarget = nodes.find((n) => n.id === e.target);
        if (!nSource || !nTarget) return;

        ctx.beginPath();
        ctx.moveTo(nSource.x, nSource.y);
        ctx.lineTo(nTarget.x, nTarget.y);
        
        // Color based on transaction direction/intensity
        const flowSize = Math.max(1.5, Math.min(8, Math.log10(e.totalAmount)));
        ctx.lineWidth = flowSize;
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)'; // pink money glow
        ctx.stroke();

        // Draw directional arrow in middle
        const midX = (nSource.x + nTarget.x) / 2;
        const midY = (nSource.y + nTarget.y) / 2;
        const angle = Math.atan2(nTarget.y - nSource.y, nTarget.x - nSource.x);
        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-5, -4);
        ctx.lineTo(5, 0);
        ctx.lineTo(-5, 4);
        ctx.fillStyle = '#ec4899';
        ctx.fill();
        ctx.restore();

        // Draw transaction amount text near edge line
        ctx.font = '10px monospace';
        ctx.fillStyle = 'var(--color-garuda-300)';
        ctx.fillText(`₹${e.totalAmount.toLocaleString()}`, midX + 6, midY - 6);
      });

      // Draw Nodes (Offenders + counterparties)
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        
        // Custom color codes
        if (n.isCenter) {
          ctx.fillStyle = '#f97316'; // Central focus orange
          ctx.strokeStyle = '#ffffff';
        } else if (n.type === 'offender') {
          const color = n.riskScore >= 75 ? '#dc2626' : n.riskScore >= 45 ? '#ea580c' : '#16a34a';
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffffff';
        } else {
          ctx.fillStyle = '#475569'; // Grey counterparty
          ctx.strokeStyle = '#94a3b8';
        }
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        // Label details below
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = 'var(--color-garuda-10) || #ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + n.radius + 14);

        if (n.type === 'offender' && !n.isCenter && n.riskScore !== null) {
          ctx.font = '9px monospace';
          ctx.fillStyle = 'var(--color-garuda-400)';
          ctx.fillText(`Risk:${n.riskScore}`, n.x, n.y + n.radius + 24);
        }
      });

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(updatePhysicsAndDraw);
    };

    const screenToWorld = (sx, sy) => {
      const transform = transformRef.current;
      return {
        x: (sx - transform.panX) / transform.zoom,
        y: (sy - transform.panY) / transform.zoom,
      };
    };

    // Start simulation frame
    animationFrameRef.current = requestAnimationFrame(updatePhysicsAndDraw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeTab, flowGraphData]);

  // -------------------------------------------------------------
  // CANVAS MOUSE EVENT LISTENERS
  // -------------------------------------------------------------
  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mousePosRef.current = { x: sx, y: sy };

    // Compute coordinate translation
    const transform = transformRef.current;
    const wx = (sx - transform.panX) / transform.zoom;
    const wy = (sy - transform.panY) / transform.zoom;

    // Detect click hit on nodes
    const hitNode = nodesRef.current.find((n) => {
      const dx = n.x - wx;
      const dy = n.y - wy;
      return dx * dx + dy * dy < n.radius * n.radius;
    });

    if (hitNode) {
      dragNodeRef.current = hitNode;
      setSelectedNodeDetails(hitNode);
      setSelectedEdgeDetails(null);
    } else {
      // Hit check for edges
      const hitEdge = edgesRef.current.find((edge) => {
        const nS = nodesRef.current.find((n) => n.id === edge.source);
        const nT = nodesRef.current.find((n) => n.id === edge.target);
        if (!nS || !nT) return false;
        
        // Math point distance to segment
        const l2 = (nS.x - nT.x) * (nS.x - nT.x) + (nS.y - nT.y) * (nS.y - nT.y);
        if (l2 === 0) return false;
        let t = ((wx - nS.x) * (nT.x - nS.x) + (wy - nS.y) * (nT.y - nS.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const px = nS.x + t * (nT.x - nS.x);
        const py = nS.y + t * (nT.y - nS.y);
        const dist = Math.sqrt((wx - px) * (wx - px) + (wy - py) * (wy - py));
        return dist < 8; // threshold pixel distance
      });

      if (hitEdge) {
        setSelectedEdgeDetails(hitEdge);
        setSelectedNodeDetails(null);
      } else {
        // Drag panning activation
        isDraggingBackground.current = true;
        dragStartRef.current = { x: sx - transform.panX, y: sy - transform.panY };
        setSelectedNodeDetails(null);
        setSelectedEdgeDetails(null);
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    mousePosRef.current = { x: sx, y: sy };

    if (isDraggingBackground.current) {
      transformRef.current.panX = sx - dragStartRef.current.x;
      transformRef.current.panY = sy - dragStartRef.current.y;
    }
  };

  const handleCanvasMouseUp = () => {
    dragNodeRef.current = null;
    isDraggingBackground.current = false;
  };

  const handleZoom = (factor) => {
    transformRef.current.zoom = Math.max(0.3, Math.min(4, transformRef.current.zoom * factor));
  };

  // -------------------------------------------------------------
  // FORM MUTATIONS (STATEMENT UPLOADS & ANALYTICS)
  // -------------------------------------------------------------
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOffender || !uploadFile || !uploadForm.statementMonth) {
      alert('Offender, statement file, and month are required');
      return;
    }

    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('offenderId', String(selectedOffender.id));
    fd.append('statementMonth', uploadForm.statementMonth + '-01'); // Normalise monthly date
    fd.append('bankName', uploadForm.bankName);
    fd.append('accountNo', uploadForm.accountNo);
    fd.append('upiId', uploadForm.upiId);
    fd.append('preview', String(uploadForm.preview));

    setUploadLoading(true);
    setPreviewResult(null);

    try {
      const res = await api.post('/finance/upload-statement', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (uploadForm.preview) {
        setPreviewResult(res.data.data);
        alert('Statement parsing preview complete! Review mapped headers below.');
      } else {
        alert('Statement uploaded and analyzed successfully! Checked cross-case correlations.');
        setUploadFile(null);
        setUploadForm({ statementMonth: '', bankName: '', accountNo: '', upiId: '', preview: false });
        resetOffenderSearch();
        fetchBatches();
        fetchDashboard();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process statement upload');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCommitPreview = async () => {
    if (!selectedOffender || !uploadFile || !uploadForm.statementMonth) return;
    setUploadForm(prev => ({ ...prev, preview: false }));
    
    // Trigger upload with preview = false
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('offenderId', String(selectedOffender.id));
    fd.append('statementMonth', uploadForm.statementMonth + '-01');
    fd.append('bankName', uploadForm.bankName);
    fd.append('accountNo', uploadForm.accountNo);
    fd.append('upiId', uploadForm.upiId);
    fd.append('preview', 'false');

    setUploadLoading(true);
    try {
      await api.post('/finance/upload-statement', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert('Statement committed and analyzed successfully!');
      setUploadFile(null);
      setUploadForm({ statementMonth: '', bankName: '', accountNo: '', upiId: '', preview: false });
      setPreviewResult(null);
      resetOffenderSearch();
      fetchBatches();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to commit statement');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRerunBatchAnalysis = async (batchId) => {
    if (!window.confirm('Are you sure you want to re-run cross-analysis algorithms on this batch?')) return;
    try {
      await api.post(`/finance/rerun-analysis/${batchId}`);
      alert('Cross-analysis re-run complete!');
      fetchBatches();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to re-run batch analysis');
    }
  };

  const handleEditNotesClick = (txn) => {
    setActiveTxn(txn);
    setTxnNotesVal(txn.notes || '');
    setTxnFlaggedVal(txn.isFlagged);
  };

  const handleSaveNotesSubmit = async (e) => {
    e.preventDefault();
    if (!activeTxn) return;
    setSaveNotesLoading(true);
    try {
      await api.put(`/finance/transaction/${activeTxn.id}`, {
        notes: txnNotesVal,
        isFlagged: txnFlaggedVal,
      });
      alert('Transaction updated successfully!');
      setActiveTxn(null);
      fetchTransactions();
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update transaction notes');
    } finally {
      setSaveNotesLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Financial Intelligence & Asset Audits
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Map money trails, ingest suspect bank statements, identify shadow financiers, and run layering audits.
          </p>
        </div>

        {/* Mini stats dashboard */}
        {dashboardData && (
          <div className="flex gap-4">
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">Total statements</span>
              <span className="text-xl font-bold text-green-500">{dashboardData.kpis?.totalStatements || 0}</span>
            </div>
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">🔴 Accused Matches</span>
              <span className="text-xl font-bold text-red-500">{dashboardData.kpis?.offenderLinks || 0}</span>
            </div>
            <div className="bg-garuda-800 border border-garuda-700/60 rounded-xl px-4 py-2 text-center shadow-card">
              <span className="block text-[10px] uppercase font-bold text-garuda-400">Suspicious Transactions</span>
              <span className="text-xl font-bold text-purple-400">{dashboardData.kpis?.highValue || 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--color-garuda-700)', paddingBottom: '0.75rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              resetOffenderSearch();
            }}
            className={`btn btn-sm flex items-center gap-1.5 ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : tab.color} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content body */}
      <div className="card rounded-xl p-6 border border-slate-100/50 dark:border-slate-800" style={{ background: 'var(--color-garuda-800)' }}>
        
        {/* ── UPLOAD & MANAGE TAB ── */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form Input fields */}
              <div className="lg:col-span-1 space-y-4">
                <div>
                  <h3 className="text-md font-bold text-garuda-100">Upload Suspect Statements</h3>
                  <p className="text-xs text-garuda-400">Parse CSV, XLSX, or PDF statement files to run cross-case analysis.</p>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4 p-4 rounded-xl bg-garuda-900/40 border border-garuda-700">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-garuda-200">Select Suspect Accused *</label>
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
                      <label className="block text-xs font-semibold mb-1 text-garuda-200">Statement Month *</label>
                      <input 
                        type="month"
                        value={uploadForm.statementMonth}
                        onChange={e => setUploadForm({ ...uploadForm, statementMonth: e.target.value })}
                        className="input text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-garuda-200">Bank Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. SBI / HDFC"
                        value={uploadForm.bankName}
                        onChange={e => setUploadForm({ ...uploadForm, bankName: e.target.value })}
                        className="input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-garuda-200">Account Number</label>
                      <input 
                        type="text"
                        placeholder="Raw digits"
                        value={uploadForm.accountNo}
                        onChange={e => setUploadForm({ ...uploadForm, accountNo: e.target.value })}
                        className="input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-garuda-200">UPI Address ID</label>
                      <input 
                        type="text"
                        placeholder="e.g. name@upi"
                        value={uploadForm.upiId}
                        onChange={e => setUploadForm({ ...uploadForm, upiId: e.target.value })}
                        className="input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-garuda-200">Select statement file (Excel, CSV, PDF) *</label>
                    <input 
                      type="file" 
                      accept=".csv, .xlsx, .xls, .pdf"
                      onChange={e => setUploadFile(e.target.files[0])}
                      className="input py-2 text-xs"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="checkbox-preview"
                      checked={uploadForm.preview}
                      onChange={e => setUploadForm({ ...uploadForm, preview: e.target.checked })}
                      className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 w-4 h-4"
                    />
                    <label htmlFor="checkbox-preview" className="text-xs font-semibold text-garuda-300 select-none">
                      Preview only (Dry-run parser checking columns)
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={uploadLoading}
                    className="btn btn-primary w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-2"
                  >
                    {uploadLoading ? 'Uploading statement...' : 'Upload Bank Statement'}
                  </button>
                </form>
              </div>

              {/* Upload Preview & column Mappings dashboard */}
              <div className="lg:col-span-2 space-y-4">
                {previewResult ? (
                  <div className="space-y-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-green-400 text-sm">Dry Run Parser Preview</h4>
                        <p className="text-xs text-garuda-400 mt-0.5">Found {previewResult.parsedCount} transactions. Review parsed samples below.</p>
                      </div>
                      <button
                        onClick={handleCommitPreview}
                        disabled={uploadLoading}
                        className="btn btn-sm btn-primary flex items-center gap-1"
                      >
                        <IconArrowRight size={14} />
                        <span>Commit Statement</span>
                      </button>
                    </div>

                    {/* parsed sample rows table */}
                    <div className="overflow-x-auto border border-garuda-700 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="table-header bg-garuda-700/60 text-garuda-200">
                            <th className="p-2">Date</th>
                            <th className="p-2">Reference</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Counterparty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewResult.sampleRows?.slice(0, 8).map((row, idx) => (
                            <tr key={idx} className="border-b border-garuda-800 hover:bg-garuda-600/25 text-garuda-300">
                              <td className="p-2">{row.txn_date || row.Date}</td>
                              <td className="p-2 font-mono text-[10px]">{row.transaction_ref || row.Reference || '—'}</td>
                              <td className="p-2 text-right font-bold text-white">₹{Number(row.amount || row.Amount || 0).toLocaleString()}</td>
                              <td className="p-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.direction === 'INCOMING' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                                  {row.direction || 'OUTGOING'}
                                </span>
                              </td>
                              <td className="p-2 truncate max-w-[150px]">{row.counterparty_name || row.Counterparty || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-md font-bold text-garuda-100">Historical Statement Upload Batches</h3>
                    {loading ? (
                      <div className="text-center py-12 text-garuda-400">Loading batch history...</div>
                    ) : batches.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                        No statement upload batches found.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-garuda-700 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="table-header bg-garuda-700/60 text-garuda-200">
                              <th className="p-3">Suspect Name</th>
                              <th className="p-3">File Name</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Transactions</th>
                              <th className="p-3 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batches.map((b) => (
                              <tr key={b.id} className="border-b border-garuda-700 hover:bg-garuda-600/30">
                                <td className="p-3 font-bold text-garuda-100">{b.offenderName}</td>
                                <td className="p-3 text-garuda-300">{b.fileName}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    b.status === 'COMPLETED' ? 'bg-green-600/20 text-green-400' :
                                    b.status === 'FAILED' ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'
                                  }`}>
                                    {b.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-bold text-garuda-50">{b.totalRecords}</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleRerunBatchAnalysis(b.id)}
                                    className="btn btn-sm btn-secondary font-semibold text-[10px] py-1 px-2 flex items-center gap-1 mx-auto"
                                    style={{ borderColor: 'var(--color-garuda-500)' }}
                                  >
                                    <IconRefresh size={10} /> Rerun Analysis
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
              </div>

            </div>
          </div>
        )}

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            {/* KPI grid panel */}
            {dashboardData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-garuda-700 bg-garuda-900/30">
                  <div className="text-xs text-garuda-400 font-semibold uppercase">Statements Uploaded</div>
                  <div className="text-2xl font-bold mt-1 text-garuda-50">{dashboardData.kpis?.totalStatements || 0}</div>
                  <span className="text-[10px] text-green-400 font-bold">+{dashboardData.kpis?.statementsThisMonth || 0} this month</span>
                </div>
                <div className="p-4 rounded-xl border border-garuda-700 bg-garuda-900/30">
                  <div className="text-xs text-garuda-400 font-semibold uppercase">Flagged Transactions</div>
                  <div className="text-2xl font-bold mt-1 text-red-400">
                    {(dashboardData.kpis?.highValue || 0) + (dashboardData.kpis?.layering || 0)}
                  </div>
                  <span className="text-[10px] text-garuda-500">From total {dashboardData.kpis?.totalTransactions || 0} txns</span>
                </div>
                <div className="p-4 rounded-xl border border-garuda-700 bg-garuda-900/30">
                  <div className="text-xs text-garuda-400 font-semibold uppercase">Offender Links</div>
                  <div className="text-2xl font-bold mt-1 text-red-500">{dashboardData.kpis?.offenderLinks || 0}</div>
                  <span className="text-[10px] text-red-400 font-bold">🔴 High alerts matching database</span>
                </div>
                <div className="p-4 rounded-xl border border-garuda-700 bg-garuda-900/30">
                  <div className="text-xs text-garuda-400 font-semibold uppercase">Shared Counterparties</div>
                  <div className="text-2xl font-bold mt-1 text-amber-500">{dashboardData.kpis?.commonCounterparties || 0}</div>
                  <span className="text-[10px] text-amber-400 font-bold">🔵 Linked to 2+ suspects</span>
                </div>
              </div>
            )}

            {/* Visualisations: charts and alerts feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left side: Recharts Monthly trend */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-md font-bold text-garuda-100">Monthly Transaction Audit Trend</h3>
                <div className="h-72 w-full p-4 rounded-xl bg-garuda-900/25 border border-garuda-700">
                  {monthlyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        <Legend verticalAlign="top" height={36} />
                        <Line name="Total Transactions" type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2.5} activeDot={{ r: 8 }} />
                        <Line name="Flagged Suspicious" type="monotone" dataKey="flagged" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-garuda-400">No trend history datasets found.</div>
                  )}
                </div>
              </div>

              {/* Right side: Alerts feed */}
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-md font-bold text-garuda-100 flex items-center gap-2">
                  <IconWarning color="#ef4444" size={18} />
                  <span>Real-time Financial Alerts</span>
                </h3>
                
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {recentAlerts.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-xs text-garuda-400">
                      No suspicious alert flags generated.
                    </div>
                  ) : (
                    recentAlerts.map((alert) => (
                      <div key={alert.id} className="p-3 border border-red-500/10 bg-red-500/5 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <strong className="text-garuda-100 text-sm">₹{alert.amount.toLocaleString()}</strong>
                            <div className="text-[10px] text-garuda-400 mt-0.5">Suspect: <strong className="text-garuda-200">{alert.offenderName}</strong></div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            alert.priority === 'HIGH' ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'
                          }`}>
                            {alert.priority}
                          </span>
                        </div>
                        <p className="text-garuda-300 leading-relaxed text-[11px]">Reason: {alert.reason || 'High-value transaction detected'}</p>
                        {alert.matchedOffenderName && (
                          <div className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">
                            Matched database suspect: <strong>{alert.matchedOffenderName}</strong>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── TRANSACTION EXPLORER TAB ── */}
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Transaction Audit Register</h2>
                <p className="text-xs text-garuda-400">Inspect historical transaction records parsed from uploaded suspect statements.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setRevealAccounts(!revealAccounts)}
                  className="btn btn-sm btn-secondary flex items-center gap-1.5"
                >
                  <IconLock size={14} />
                  <span>{revealAccounts ? 'Mask accounts' : 'Reveal Raw PII'}</span>
                </button>
              </div>
            </div>

            {/* Explorer filter forms */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-garuda-900/50 border border-garuda-700 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-garuda-400 mb-1">Direction</label>
                <select
                  value={explorerFilters.direction}
                  onChange={e => setExplorerFilters({ ...explorerFilters, direction: e.target.value })}
                  className="select text-xs py-1"
                >
                  <option value="">All transactions</option>
                  <option value="INCOMING">Incoming only</option>
                  <option value="OUTGOING">Outgoing only</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-garuda-400 mb-1">Amount Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={explorerFilters.amountMin}
                    onChange={e => setExplorerFilters({ ...explorerFilters, amountMin: e.target.value })}
                    className="input text-xs py-1"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={explorerFilters.amountMax}
                    onChange={e => setExplorerFilters({ ...explorerFilters, amountMax: e.target.value })}
                    className="input text-xs py-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 font-semibold text-garuda-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explorerFilters.flaggedOnly}
                    onChange={e => setExplorerFilters({ ...explorerFilters, flaggedOnly: e.target.checked })}
                    className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 w-4 h-4"
                  />
                  <span>Flagged Suspicious</span>
                </label>
                <label className="flex items-center gap-2 font-semibold text-garuda-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={explorerFilters.matchedOnly}
                    onChange={e => setExplorerFilters({ ...explorerFilters, matchedOnly: e.target.checked })}
                    className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 w-4 h-4"
                  />
                  <span>Accused Matches</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => {
                    setTxPage(0);
                    fetchTransactions();
                  }}
                  className="btn btn-primary w-full text-xs font-semibold py-1.5 flex items-center justify-center gap-1.5"
                >
                  <IconSearch size={12} /> Apply Filters
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Loading audited transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                No transactions matching query found.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-garuda-700 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="table-header bg-garuda-700/60 text-garuda-200">
                        <th className="p-3">Date</th>
                        <th className="p-3">Suspect Name</th>
                        <th className="p-3">Bank Details</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Counterparty Name</th>
                        <th className="p-3">Flag / Investigator notes</th>
                        <th className="p-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-garuda-700 hover:bg-garuda-600/30">
                          <td className="p-3 font-mono">{new Date(t.txnDate).toLocaleDateString()}</td>
                          <td className="p-3 font-bold text-garuda-100">{t.offenderName}</td>
                          <td className="p-3 text-garuda-300">
                            {t.bankName || '—'}<br />
                            <span className="font-mono text-[10px] text-garuda-400">{t.accountNo || t.upiId || '—'}</span>
                          </td>
                          <td className="p-3 text-right font-bold text-garuda-50">₹{t.amount.toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.direction === 'INCOMING' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="p-3 truncate max-w-[150px]">
                            {t.counterpartyName || '—'}<br />
                            <span className="font-mono text-[10px] text-garuda-400">{t.counterpartyAccount || '—'}</span>
                          </td>
                          <td className="p-3">
                            {t.isFlagged ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white mr-2 block w-fit">
                                {t.alertCategory || 'SUSPICIOUS'}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-garuda-400 block truncate max-w-[150px] mt-1">{t.notes || 'No notes added'}</span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleEditNotesClick(t)}
                              className="btn btn-sm btn-secondary text-[10px] py-1 px-2 border-garuda-500"
                            >
                              Edit Note
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {txTotalPages > 1 && (
                  <div className="flex justify-between items-center text-xs text-garuda-400 pt-2">
                    <div>Showing Page {txPage + 1} of {txTotalPages} ({txTotalElements} total elements)</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTxPage(p => Math.max(0, p - 1))}
                        disabled={txPage === 0}
                        className="btn btn-sm btn-secondary"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))}
                        disabled={txPage === txTotalPages - 1}
                        className="btn btn-sm btn-secondary"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MONEY FLOW MAP TAB ── */}
        {activeTab === 'flow' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Contraband Money Flow Network</h2>
                <p className="text-xs text-garuda-400">Trace transfer matrices centered on specific suspects to expose hidden handlers.</p>
              </div>

              {/* Selector form */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white w-full sm:w-64">
                    <span className="font-bold truncate">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search center suspect..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input py-1 text-xs"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-[10px] text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => {
                              setSelectedOffender(o);
                              setFlowCenterId(o.id);
                              fetchFlowMap(o.id);
                            }}
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
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Generating graph physics matrix...</div>
            ) : !flowGraphData ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                Please search and select a suspect above to visualize their money flow map.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Canvas viewport and controls */}
                <div className="lg:col-span-3 space-y-3 relative">
                  {/* Floating Pan/Zoom controller */}
                  <div className="absolute top-3 left-3 bg-garuda-900/80 border border-garuda-700 rounded-xl p-2 z-10 flex gap-2 shadow-glow text-white">
                    <button onClick={() => handleZoom(1.2)} className="w-8 h-8 rounded hover:bg-garuda-700 font-bold text-sm" title="Zoom In">+</button>
                    <button onClick={() => handleZoom(0.8)} className="w-8 h-8 rounded hover:bg-garuda-700 font-bold text-sm" title="Zoom Out">-</button>
                    <button onClick={() => { transformRef.current = { zoom: 1, panX: 0, panY: 0 }; }} className="w-8 h-8 rounded hover:bg-garuda-700 text-xs font-semibold" title="Reset View">Reset</button>
                  </div>

                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={450}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    className="w-full rounded-xl border border-garuda-700 cursor-grab active:cursor-grabbing"
                    style={{ background: '#090d16' }}
                  />
                  <div className="text-[10px] text-garuda-400 text-center italic">Drag nodes to reposition. Drag background to pan. Mouse-wheel to zoom.</div>
                </div>

                {/* Sidebar details panel */}
                <div className="lg:col-span-1 p-4 rounded-xl border border-garuda-700 bg-garuda-900/40 text-xs space-y-4">
                  <h3 className="font-bold text-garuda-100 text-sm uppercase border-b border-garuda-700 pb-2">Network Detail Inspector</h3>
                  
                  {selectedNodeDetails ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] font-bold text-garuda-400 uppercase">Entity Label</div>
                        <strong className="text-sm text-white">{selectedNodeDetails.label}</strong>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-garuda-400 uppercase">Type</div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block mt-1 ${
                          selectedNodeDetails.type === 'offender' ? 'bg-orange-600/20 text-orange-400' : 'bg-slate-600/20 text-slate-400'
                        }`}>
                          {selectedNodeDetails.type === 'offender' ? 'Registered Accused' : 'Unknown Account'}
                        </span>
                      </div>
                      {selectedNodeDetails.type === 'offender' && (
                        <div>
                          <div className="text-[10px] font-bold text-garuda-400 uppercase">Accused Risk Score</div>
                          <strong className="text-sm text-red-400">{selectedNodeDetails.riskScore || '—'}/100</strong>
                        </div>
                      )}
                      {selectedNodeDetails.account && (
                        <div>
                          <div className="text-[10px] font-bold text-garuda-400 uppercase">UPI/Account ID</div>
                          <span className="font-mono text-[10px] text-garuda-300 break-all">{selectedNodeDetails.account}</span>
                        </div>
                      )}
                    </div>
                  ) : selectedEdgeDetails ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-garuda-200">Transaction Edge details</h4>
                      <div>
                        <div className="text-[10px] text-garuda-400">Total Money Flow</div>
                        <strong className="text-sm text-green-400">₹{selectedEdgeDetails.totalAmount.toLocaleString()}</strong>
                      </div>
                      <div>
                        <div className="text-[10px] text-garuda-400">Transact Count</div>
                        <span className="text-xs text-garuda-300 font-bold">{selectedEdgeDetails.txnCount} statements entries</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-garuda-400 italic">Click a suspect node or transaction line to inspect flow details.</p>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── FINANCIAL PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-garuda-100">Suspect Consolidated Financial Dossier</h2>
                <p className="text-xs text-garuda-400">Audit overall lifeycle discrepancies between declared income vs observed transaction volume.</p>
              </div>

              {/* Selector form */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {selectedOffender ? (
                  <div className="p-2.5 rounded bg-garuda-900 border border-garuda-700 flex justify-between items-center text-xs text-white w-full sm:w-64">
                    <span className="font-bold truncate">{selectedOffender.full_name}</span>
                    <button type="button" onClick={() => setSelectedOffender(null)} className="text-red-400 font-bold hover:underline">Clear</button>
                  </div>
                ) : (
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search suspect profile..."
                      value={offenderQuery}
                      onChange={e => setOffenderQuery(e.target.value)}
                      className="input py-1 text-xs"
                    />
                    {searchLoading && <span className="absolute right-2 top-2 text-[10px] text-garuda-400">Searching...</span>}
                    {offenderResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-garuda-900 border border-garuda-700 rounded shadow-elevated z-10 max-h-40 overflow-y-auto">
                        {offenderResults.map(o => (
                          <div
                            key={o.id}
                            onClick={() => {
                              setSelectedOffender(o);
                              setProfileOffenderId(o.id);
                              fetchProfile(o.id);
                            }}
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
            </div>

            {loading ? (
              <div className="text-center py-12 text-garuda-400">Analyzing statement flows...</div>
            ) : !profileData ? (
              <div className="text-center py-12 border border-dashed border-garuda-700 rounded-xl text-garuda-400">
                Please search and select a suspect above to load their financial profile reports.
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Discrepancy Warnings Cards */}
                {profileData.incomeDiscrepancy && profileData.incomeDiscrepancy.ratio > 1.2 ? (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-xs">
                    <div className="text-red-400 font-bold text-lg">⚠️</div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-red-400 text-sm">High Income-Lifestyle Discrepancy Flagged</h4>
                      <p className="text-garuda-300">
                        This suspect's observed account inflow sums to <strong>₹{profileData.incomeDiscrepancy.observedInflow.toLocaleString()}</strong>, which is <strong>{profileData.incomeDiscrepancy.ratio}x</strong> their declared annual monthly income baseline (₹{(profileData.incomeDiscrepancy.declaredAnnual).toLocaleString()}). This suggests significant unaccounted funds flow.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-xs">
                    <h4 className="font-bold text-green-400">Discrepancy Check Complete</h4>
                    <p className="text-garuda-300 mt-1">Declared monthly income baseline is aligned with observed transaction inflows.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Anomalies & lists */}
                  <div className="lg:col-span-1 space-y-4 text-xs">
                    <h3 className="text-sm font-bold text-garuda-100 border-b border-garuda-700 pb-2">Detected Flow Anomalies</h3>
                    {profileData.anomalies && profileData.anomalies.length > 0 ? (
                      <div className="space-y-2">
                        {profileData.anomalies.map((anom, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-garuda-900/50 border border-garuda-700 space-y-1">
                            <strong className="text-red-400 font-bold">{anom.type || 'Anomaly Detected'}</strong>
                            <p className="text-garuda-300">{anom.detail || anom.reason || 'Irregular transacting patterns'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-garuda-400 italic">No temporal or frequency flow anomalies detected currently.</p>
                    )}
                  </div>

                  {/* Right Column: Recharts Inflow vs Outflow Chart */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-garuda-100">Inflow vs Outflow MoM Analysis</h3>
                    <div className="h-72 w-full p-4 rounded-xl bg-garuda-900/25 border border-garuda-700">
                      {profileData.monthlyFlow && profileData.monthlyFlow.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={profileData.monthlyFlow}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                            <Legend verticalAlign="top" height={36} />
                            <Bar name="Incoming Inflow" dataKey="inflow" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            <Bar name="Outgoing Outflow" dataKey="outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-garuda-400">No monthly flow history records.</div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* ── DETAILS / EDIT NOTES MODAL ── */}
      {activeTxn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-garuda-800 border border-garuda-700 rounded-xl max-w-lg w-full p-6 space-y-4 animate-slide-up text-xs">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-garuda-100">Transaction Notes & Review</h3>
              <button onClick={() => setActiveTxn(null)} className="text-garuda-400 hover:text-white">✕</button>
            </div>

            <div className="p-3 rounded-lg bg-garuda-900 border border-garuda-700 space-y-2 text-garuda-300">
              <div>Date: <strong className="text-white">{new Date(activeTxn.txnDate).toLocaleDateString()}</strong></div>
              <div>Amount: <strong className="text-green-400">₹{activeTxn.amount.toLocaleString()}</strong></div>
              <div>Narration: <span className="font-mono text-garuda-400">{activeTxn.narration || '—'}</span></div>
            </div>

            <form onSubmit={handleSaveNotesSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modal-txn-flagged"
                  checked={txnFlaggedVal}
                  onChange={e => setTxnFlaggedVal(e.target.checked)}
                  className="rounded border-garuda-600 bg-garuda-800 text-orange-500 focus:ring-0 w-4 h-4"
                />
                <label htmlFor="modal-txn-flagged" className="text-xs font-semibold text-garuda-300 select-none">
                  Flag as Suspicious / Layering Activity
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-garuda-200">Investigator Note / Review details</label>
                <textarea
                  rows="4"
                  placeholder="Log details..."
                  value={txnNotesVal}
                  onChange={e => setTxnNotesVal(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setActiveTxn(null)} className="btn btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={saveNotesLoading} className="btn btn-primary text-xs">
                  {saveNotesLoading ? 'Saving notes...' : 'Save Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
