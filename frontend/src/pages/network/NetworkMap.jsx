/**
 * GARUDA — Network & Chain of Command Analysis (Page 7)
 * Route: /network
 * Visualise and map the full drug supply chain with accused linkage graphs and correlation intelligence.
 * Driven by the Python FastAPI Microservice.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconNetwork, IconMap, IconChain, IconShield, IconPackage, IconCases,
} from '../../components/Icons';

const TABS = [
  { id: 'chain', label: 'Chain Builder', Icon: IconNetwork, color: '#6366f1' },
  { id: 'clusters', label: 'Network Clusters', Icon: IconChain, color: '#059669' },
  { id: 'kingpin', label: 'Kingpin Profiling', Icon: IconShield, color: '#dc2626' },
  { id: 'interstate', label: 'Interstate Links', Icon: IconMap, color: '#0891b2' },
  { id: 'consignment', label: 'Consignment Trail', Icon: IconPackage, color: '#f59e0b' },
  { id: 'linkage', label: 'Case Linkage', Icon: IconCases, color: '#8b5cf6' },
];

const NODE_TYPES = [
  { type: 'KINGPIN', color: '#ef4444', desc: 'Kingpin / Organizer' },
  { type: 'LOCAL_SUPPLIER', color: '#f97316', desc: 'Local Supplier' },
  { type: 'INTERSTATE_SUPPLIER', color: '#ec4899', desc: 'Interstate Supplier' },
  { type: 'TRANSPORTER', color: '#8b5cf6', desc: 'Carries/Transports contraband' },
  { type: 'PEDDLER', color: '#eab308', desc: 'Street-level seller' },
  { type: 'CONSUMER', color: '#22c55e', desc: 'End user' },
  { type: 'Unknown', color: '#94a3b8', desc: 'Not specified' },
];

const NODE_COLORS = {
  'KINGPIN': '#ef4444',
  'LOCAL_SUPPLIER': '#f97316',
  'INTERSTATE_SUPPLIER': '#ec4899',
  'TRANSPORTER': '#8b5cf6',
  'PEDDLER': '#eab308',
  'CONSUMER': '#22c55e',
  'UNKNOWN': '#94a3b8',
  'Unknown': '#94a3b8',
};

export default function NetworkMap() {
  const [activeTab, setActiveTab] = useState('chain');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isServiceConnected, setIsServiceConnected] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [focusMode, setFocusMode] = useState(true);

  // Selected Suspect info drawer
  const [selectedNode, setSelectedNode] = useState(null);

  // Duplicates State
  const [duplicates, setDuplicates] = useState({
    duplicate_phones: [],
    duplicate_imeis: [],
    total_phone_correlations: 0,
    total_imei_correlations: 0
  });
  const [dupLoading, setDupLoading] = useState(false);

  // ML Risk Predictor Form State
  const [predictAge, setPredictAge] = useState(25);
  const [predictCategory, setPredictCategory] = useState('PEDDLER');
  const [predictPriors, setPredictPriors] = useState(2);
  const [predictQuantity, setPredictQuantity] = useState(5.5);
  const [predictResult, setPredictResult] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictError, setPredictError] = useState(null);

  // Phase B State Hooks
  const [interstateData, setInterstateData] = useState([]);
  const [interstateLoading, setInterstateLoading] = useState(false);
  const [consignmentData, setConsignmentData] = useState([]);
  const [consignmentLoading, setConsignmentLoading] = useState(false);
  const [linkageData, setLinkageData] = useState([]);
  const [linkageLoading, setLinkageLoading] = useState(false);

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const draggedNodeRef = useRef(null);
  const hoveredNodeRef = useRef(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  const activeNodesRef = useRef([]);
  const activeEdgesRef = useRef([]);

  useEffect(() => {
    const allNodes = nodesRef.current;
    const allEdges = edgesRef.current;

    const hasSearch = !!searchQuery;
    const hasSelection = !!selectedNode;

    if (!focusMode || (!hasSearch && !hasSelection)) {
      if (categoryFilter === 'ALL') {
        activeNodesRef.current = allNodes;
        activeEdgesRef.current = allEdges;
      } else {
        const filteredNodes = allNodes.filter(n => n.category === categoryFilter);
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        activeNodesRef.current = filteredNodes;
        activeEdgesRef.current = allEdges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
      }
      return;
    }

    const targetIds = new Set();

    if (hasSelection) {
      targetIds.add(selectedNode.id);
    }

    if (hasSearch) {
      const query = searchQuery.toLowerCase();
      allNodes.forEach(n => {
        if (n.name.toLowerCase().includes(query) || (n.alias && n.alias.toLowerCase().includes(query))) {
          targetIds.add(n.id);
        }
      });
    }

    // Build graph adjacency list to perform BFS for complete connected components
    const adj = {};
    allNodes.forEach(n => { adj[n.id] = []; });
    allEdges.forEach(e => {
      if (adj[e.source] && adj[e.target]) {
        adj[e.source].push(e.target);
        adj[e.target].push(e.source);
      }
    });

    // BFS to gather all transitively connected nodes in the component
    const activeIds = new Set();
    const queue = [...targetIds];
    targetIds.forEach(id => activeIds.add(id));

    while (queue.length > 0) {
      const currId = queue.shift();
      const neighbors = adj[currId] || [];
      neighbors.forEach(neighborId => {
        if (!activeIds.has(neighborId)) {
          activeIds.add(neighborId);
          queue.push(neighborId);
        }
      });
    }

    let filteredNodes = allNodes.filter(n => activeIds.has(n.id));

    if (categoryFilter !== 'ALL') {
      filteredNodes = filteredNodes.filter(n => n.category === categoryFilter || targetIds.has(n.id));
    }

    const finalActiveIds = new Set(filteredNodes.map(n => n.id));
    activeNodesRef.current = filteredNodes;
    activeEdgesRef.current = allEdges.filter(e => finalActiveIds.has(e.source) && finalActiveIds.has(e.target));
  }, [searchQuery, selectedNode, categoryFilter, focusMode, nodes, edges]);
  
  const navigate = useNavigate();
  const perms = usePermissions();

  // Load Graph Data
  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/intelligence/network-graph');
      const data = response.data.data;
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setSummary(data.summary || null);
      setIsServiceConnected(true);
      
      // Reset zoom and pan
      zoomRef.current = 1;
      panRef.current = { x: 0, y: 0 };

      // Initialize node coordinates for the Force-Directed simulation
      const width = 1200;
      const height = 800;
      const fetchedNodes = data.nodes || [];
      const fetchedEdges = data.edges || [];

      // Compute connected components
      const adj = {};
      fetchedNodes.forEach(n => { adj[n.id] = []; });
      fetchedEdges.forEach(e => {
        if (adj[e.source] && adj[e.target]) {
          adj[e.source].push(e.target);
          adj[e.target].push(e.source);
        }
      });

      const visited = new Set();
      const components = [];
      fetchedNodes.forEach(n => {
        if (!visited.has(n.id)) {
          const comp = [];
          const queue = [n.id];
          visited.add(n.id);
          while (queue.length > 0) {
            const currId = queue.shift();
            comp.push(currId);
            adj[currId].forEach(neighborId => {
              if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push(neighborId);
              }
            });
          }
          components.push(comp);
        }
      });

      // Sort components by size descending
      components.sort((a, b) => b.length - a.length);

      // Create a map of node ID to its target center
      const nodeCenters = {};
      components.forEach((comp, compIdx) => {
        let targetX = width / 2;
        let targetY = height / 2;

        if (compIdx > 0) {
          const isIsolated = comp.length === 1;
          
          // Concentric spiral rings using golden angle to avoid crowding/overlaps
          let ringIndex = 0;
          if (isIsolated) {
            ringIndex = compIdx % 3; 
          } else {
            ringIndex = compIdx % 2;
          }
          
          const baseRadius = isIsolated ? 350 : 200;
          const radius = baseRadius + ringIndex * 110;
          
          const angle = compIdx * 2.39996; // Golden angle in radians
          
          targetX = width / 2 + Math.cos(angle) * radius;
          targetY = height / 2 + Math.sin(angle) * radius;
        }

        comp.forEach(nodeId => {
          nodeCenters[nodeId] = { x: targetX, y: targetY };
        });
      });

      nodesRef.current = fetchedNodes.map((node, index) => {
        const angle = index * 0.5;
        const center = nodeCenters[node.id] || { x: width / 2, y: height / 2 };
        return {
          ...node,
          x: center.x + Math.cos(angle) * (20 + (index % 5) * 10),
          y: center.y + Math.sin(angle) * (20 + (index % 5) * 10),
          vx: 0,
          vy: 0,
          radius: 16,
          pinned: false,
          targetCx: center.x,
          targetCy: center.y
        };
      });
      edgesRef.current = data.edges || [];
    } catch (err) {
      console.error(err);
      setError('Could not connect to the Intelligence Microservice. Make sure it is running on port 8082.');
      setIsServiceConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // Load Contact Correlations
  const loadDuplicatesData = async () => {
    setDupLoading(true);
    try {
      const response = await api.get('/intelligence/duplicate-contacts');
      setDuplicates(response.data.data);
      setIsServiceConnected(true);
    } catch (err) {
      console.error(err);
      setIsServiceConnected(false);
    } finally {
      setDupLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, []);

  // Handle Canvas Zoom (mouse wheel)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      if (activeTab !== 'chain') return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      const zoomIntensity = 0.05;
      const oldZoom = zoomRef.current;
      
      let newZoom = oldZoom;
      if (e.deltaY < 0) {
        newZoom = Math.min(3.0, oldZoom + zoomIntensity);
      } else {
        newZoom = Math.max(0.4, oldZoom - zoomIntensity);
      }

      const graphX = (mx - panRef.current.x) / oldZoom;
      const graphY = (my - panRef.current.y) / oldZoom;
      
      zoomRef.current = newZoom;
      panRef.current = {
        x: mx - graphX * newZoom,
        y: my - graphY * newZoom
      };
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [activeTab, loading, error]);

  // Phase B API calls
  const loadInterstateData = async () => {
    setInterstateLoading(true);
    try {
      const response = await api.get('/intelligence/interstate-routes');
      setInterstateData(response.data.data.routes || []);
      setIsServiceConnected(true);
    } catch (err) {
      console.error(err);
      setIsServiceConnected(false);
    } finally {
      setInterstateLoading(false);
    }
  };

  const loadConsignmentData = async () => {
    setConsignmentLoading(true);
    try {
      const response = await api.get('/intelligence/consignment-trails');
      setConsignmentData(response.data.data.trails || []);
      setIsServiceConnected(true);
    } catch (err) {
      console.error(err);
      setIsServiceConnected(false);
    } finally {
      setConsignmentLoading(false);
    }
  };

  const loadLinkageData = async () => {
    setLinkageLoading(true);
    try {
      const response = await api.get('/intelligence/case-linkages');
      setLinkageData(response.data.data.linkages || []);
      setIsServiceConnected(true);
    } catch (err) {
      console.error(err);
      setIsServiceConnected(false);
    } finally {
      setLinkageLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clusters') {
      loadDuplicatesData();
    } else if (activeTab === 'interstate') {
      loadInterstateData();
    } else if (activeTab === 'consignment') {
      loadConsignmentData();
    } else if (activeTab === 'linkage') {
      loadLinkageData();
    }
  }, [activeTab]);

  // Network Simulation Loop (Canvas force-directed layout)
  useEffect(() => {
    if (activeTab !== 'chain' || loading || error || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;

    // Force simulation parameters
    const centerForce = 0.0008;
    const repulsionK = 11000;
    const attractionK = 0.01;
    const restLength = 220;
    const damping = 0.85;

    const updateSimulation = () => {
      const simNodes = activeNodesRef.current;
      const simEdges = activeEdgesRef.current;

      // 1. Repulsion between all node pairs
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];
        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const distSq = dx * dx + dy * dy + 0.1;
          const dist = Math.sqrt(distSq);
          
          if (dist < 600) {
            const force = repulsionK / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            // Only apply if not being dragged and not pinned
            if (draggedNodeRef.current?.id !== n1.id && !n1.pinned) {
              n1.vx += fx;
              n1.vy += fy;
            }
            if (draggedNodeRef.current?.id !== n2.id && !n2.pinned) {
              n2.vx -= fx;
              n2.vy -= fy;
            }
          }
        }
      }

      // 2. Attraction along edges
      for (const edge of simEdges) {
        const sourceNode = simNodes.find(n => n.id === edge.source);
        const targetNode = simNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          const delta = dist - restLength;
          const force = delta * attractionK;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggedNodeRef.current?.id !== sourceNode.id && !sourceNode.pinned) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (draggedNodeRef.current?.id !== targetNode.id && !targetNode.pinned) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      }

      // 3. Gravity/Center force & Update positions
      const cx = width / 2;
      const cy = height / 2;
      
      for (const node of simNodes) {
        if (node.pinned) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        if (draggedNodeRef.current?.id === node.id) continue;

        // Pull to their group's target center instead of the global center
        const targetX = node.targetCx ?? cx;
        const targetY = node.targetCy ?? cy;

        node.vx += (targetX - node.x) * centerForce;
        node.vy += (targetY - node.y) * centerForce;

        // Apply friction/damping
        node.vx *= damping;
        node.vy *= damping;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Boundaries (generous virtual boundary to prevent infinite drift but avoid edge-clumping)
        node.x = Math.max(-300, Math.min(width + 300, node.x));
        node.y = Math.max(-300, Math.min(height + 300, node.y));
      }
    };

    const drawGraph = () => {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Apply zoom and pan transformation
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const simNodes = activeNodesRef.current;
      const simEdges = activeEdgesRef.current;
      const isDark = document.body.classList.contains('dark');

      // Draw Edges (Links)
      for (const edge of simEdges) {
        const sourceNode = simNodes.find(n => n.id === edge.source);
        const targetNode = simNodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          // Check if search active and node matches
          const isHighlighted = searchQuery && 
            (sourceNode.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
             targetNode.name.toLowerCase().includes(searchQuery.toLowerCase()));

          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          
          ctx.strokeStyle = isHighlighted 
            ? '#a78bfa' 
            : (isDark ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.6)');
          ctx.lineWidth = isHighlighted ? 2.5 : 1.2;
          ctx.stroke();

          // Draw directed arrow
          const angle = Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x);
          const arrowLength = 8;
          const arrowX = targetNode.x - Math.cos(angle) * (targetNode.radius + 2);
          const arrowY = targetNode.y - Math.sin(angle) * (targetNode.radius + 2);

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX - arrowLength * Math.cos(angle - Math.PI / 6), arrowY - arrowLength * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(arrowX - arrowLength * Math.cos(angle + Math.PI / 6), arrowY - arrowLength * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = isHighlighted 
            ? '#a78bfa' 
            : (isDark ? 'rgba(100, 116, 139, 0.6)' : 'rgba(148, 163, 184, 0.7)');
          ctx.fill();

          // Draw edge type label
          if (edge.type) {
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            
            ctx.save();
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const labelText = edge.type;
            const textWidth = ctx.measureText(labelText).width;
            
            // Draw background rectangle for readability
            ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)';
            ctx.fillRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);
            
            // Draw border
            ctx.strokeStyle = isHighlighted 
              ? '#a78bfa' 
              : (isDark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(148, 163, 184, 0.4)');
            ctx.lineWidth = 0.5;
            ctx.strokeRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);

            // Draw text
            ctx.fillStyle = isHighlighted 
              ? (isDark ? '#e9d5ff' : '#6b21a8') 
              : (isDark ? 'rgba(148, 163, 184, 0.9)' : 'rgba(71, 85, 105, 0.9)');
            ctx.fillText(labelText, midX, midY);
            ctx.restore();
          }
        }
      }

      // Draw Nodes
      for (const node of simNodes) {
        // Apply filters
        const categoryMatch = categoryFilter === 'ALL' || node.category === categoryFilter;
        const searchMatch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase()) || (node.alias && node.alias.toLowerCase().includes(searchQuery.toLowerCase()));
        const isDimmed = !categoryMatch || !searchMatch;

        const isHovered = hoveredNodeRef.current?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 3 : 0), 0, 2 * Math.PI);
        
        const baseColor = NODE_COLORS[node.category] || NODE_COLORS['Unknown'];
        
        ctx.fillStyle = isDimmed 
          ? (isDark ? 'rgba(71, 85, 105, 0.2)' : 'rgba(203, 213, 225, 0.3)') 
          : baseColor;
        ctx.fill();

        // Node border
        ctx.strokeStyle = isSelected 
          ? (isDark ? '#ffffff' : '#0f172a') 
          : (isDimmed 
              ? (isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.4)') 
              : (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)'));
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();

        // Node text label
        ctx.fillStyle = isDimmed 
          ? (isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.4)') 
          : (isDark ? '#f8fafc' : '#0f172a');
        ctx.font = isHovered || isSelected ? 'bold 11px sans-serif' : '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + (isHovered ? 15 : 12));
      }
      ctx.restore();
    };

    const tick = () => {
      updateSimulation();
      drawGraph();
      animationRef.current = requestAnimationFrame(tick);
    };

    // Start simulation loop
    tick();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [activeTab, loading, error, categoryFilter, searchQuery, selectedNode]);

  // Mouse Handlers for Canvas Graph Interaction
  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    const graphX = (mx - panRef.current.x) / zoomRef.current;
    const graphY = (my - panRef.current.y) / zoomRef.current;

    const clickedNode = activeNodesRef.current.find(node => {
      const dist = Math.sqrt((node.x - graphX) ** 2 + (node.y - graphY) ** 2);
      return dist <= node.radius + 3;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      setSelectedNode(null);
      isPanningRef.current = true;
      startPanRef.current = { x: mx - panRef.current.x, y: my - panRef.current.y };
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    const graphX = (mx - panRef.current.x) / zoomRef.current;
    const graphY = (my - panRef.current.y) / zoomRef.current;

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = graphX;
      draggedNodeRef.current.y = graphY;
    } else if (isPanningRef.current) {
      panRef.current = {
        x: mx - startPanRef.current.x,
        y: my - startPanRef.current.y
      };
    } else {
      // Find hovered node
      const hovered = activeNodesRef.current.find(node => {
        const dist = Math.sqrt((node.x - graphX) ** 2 + (node.y - graphY) ** 2);
        return dist <= node.radius + 3;
      });

      hoveredNodeRef.current = hovered || null;
      canvasRef.current.style.cursor = hovered ? 'pointer' : isPanningRef.current ? 'grabbing' : 'default';
    }
  };

  const handleMouseUpOrLeave = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.pinned = true;
      draggedNodeRef.current = null;
    }
    isPanningRef.current = false;
  };

  const handleDoubleClick = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const my = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

    const graphX = (mx - panRef.current.x) / zoomRef.current;
    const graphY = (my - panRef.current.y) / zoomRef.current;

    const dblClicked = activeNodesRef.current.find(node => {
      const dist = Math.sqrt((node.x - graphX) ** 2 + (node.y - graphY) ** 2);
      return dist <= node.radius + 3;
    });

    if (dblClicked) {
      navigate(`/offenders/${dblClicked.id}`);
    }
  };

  // Run ML Risk Predictor Request
  const runPredictor = async () => {
    setPredictLoading(true);
    setPredictResult(null);
    setPredictError(null);
    try {
      const response = await api.post('/intelligence/predict-risk', {
        age: parseInt(predictAge),
        category: predictCategory,
        previous_cases_count: parseInt(predictPriors),
        contraband_quantity: parseFloat(predictQuantity)
      });
      // FastAPI response is wrapped in response.data.data
      setPredictResult(response.data.data);
    } catch (err) {
      console.error(err);
      setPredictError('Risk prediction failed. Verify FastAPI microservice connection.');
    } finally {
      setPredictLoading(false);
    }
  };

  // Simple formatting helpers
  const formatRiskBadge = (score) => {
    const s = (score || '').toUpperCase();
    if (s === 'HIGH') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    if (s === 'MEDIUM') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border border-green-500/30';
  };

  return (
    <div className="space-y-6 animate-fade-in text-[var(--color-garuda-100)]">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <IconNetwork size={24} color="var(--color-garuda-50)" />
            Network & Chain Analysis
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Drug supply chain mapping — directed networks, key kingpins, and telephone correlation analytics
          </p>
        </div>
        
        {/* Sync Indicator */}
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border bg-[var(--color-garuda-800)] border-[var(--color-garuda-700)]">
          <span className={`w-2.5 h-2.5 rounded-full ${isServiceConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="font-mono" style={{ color: isServiceConnected ? 'var(--color-garuda-300)' : '#f87171' }}>
            {isServiceConnected ? 'Microservice Connected (Port 8082)' : 'Microservice Disconnected (Port 8082)'}
          </span>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 flex-wrap p-1.5 rounded-xl border bg-[var(--color-garuda-600)] border-[var(--color-garuda-700)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-[var(--color-garuda-800)] text-[var(--color-garuda-100)] shadow-sm border border-[var(--color-garuda-700)]' 
                : 'text-[var(--color-garuda-400)] hover:text-[var(--color-garuda-200)]'
            }`}
          >
            <tab.Icon size={16} color={activeTab === tab.id ? tab.color : 'var(--color-garuda-400)'} />
            <span>{tab.label}</span>
            {tab.id === 'chain' && summary && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {summary.total_nodes}n, {summary.total_edges}e
              </span>
            )}
          </button>
        ))}
      </div>

      {/* C4: Network Summary Statistics Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border bg-[var(--color-garuda-800)] border-[var(--color-garuda-700)] text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--color-garuda-400)]">Total Suspects</span>
            <div className="text-lg font-bold text-[var(--color-garuda-50)]">{summary.total_nodes}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--color-garuda-400)]">Network Links</span>
            <div className="text-lg font-bold text-indigo-400">{summary.total_edges}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--color-garuda-400)]">Isolated Suspects</span>
            <div className="text-lg font-bold text-yellow-500">{summary.isolated_nodes_count}</div>
          </div>
          <div className="space-y-1 text-ellipsis overflow-hidden">
            <span className="text-[10px] uppercase font-bold text-[var(--color-garuda-400)]">Top Network Hub</span>
            <div className="text-lg font-bold text-emerald-400 truncate" title={nodes.length > 0 ? [...nodes].sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0))[0]?.name : ''}>
              {nodes.length > 0 
                ? [...nodes].sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0))[0]?.name || '—'
                : '—'}
            </div>
          </div>
        </div>
      )}

      {/* TABS CONTENT */}

      {/* 1. Chain Builder (Force-Directed Graph Canvas) */}
      {activeTab === 'chain' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* Graph Controls */}
            <div className="flex justify-between items-center p-4 rounded-xl border bg-[var(--color-garuda-800)] border-[var(--color-garuda-700)] flex-wrap gap-4">
              <div className="flex gap-4 items-center flex-wrap flex-1">
                {/* Search */}
                <div className="relative max-w-xs w-full">
                  <input
                    type="text"
                    placeholder="Search suspect..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input w-full pr-10 text-xs py-1.5 focus:outline-none"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-[var(--color-garuda-400)] hover:text-[var(--color-garuda-200)] text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="select text-xs py-1.5 focus:outline-none"
                >
                  <option value="ALL">All Roles</option>
                  <option value="KINGPIN">Kingpin</option>
                  <option value="LOCAL_SUPPLIER">Local Supplier</option>
                  <option value="INTERSTATE_SUPPLIER">Interstate Supplier</option>
                  <option value="TRANSPORTER">Transporter</option>
                  <option value="PEDDLER">Peddler</option>
                  <option value="CONSUMER">Consumer</option>
                </select>

                {/* Focus Mode Toggle */}
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={focusMode}
                    onChange={(e) => setFocusMode(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-700 bg-transparent text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 focus:outline-none"
                  />
                  <span className="text-[var(--color-garuda-300)] font-medium">Ego Focus Mode</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    zoomRef.current = 1;
                    panRef.current = { x: 0, y: 0 };
                  }}
                  className="btn btn-sm btn-secondary text-xs"
                >
                  Reset View
                </button>
                <button 
                  onClick={loadGraphData}
                  className="btn btn-sm btn-secondary text-xs"
                >
                  Refresh Graph
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div className="relative rounded-2xl border overflow-hidden flex flex-col justify-center items-center bg-[var(--color-garuda-900)] border-[var(--color-garuda-700)]" style={{ minHeight: '480px' }}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--color-garuda-900)]/80">
                  <span className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>Computing PageRank & force vectors...</span>
                </div>
              )}
              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-10 text-center space-y-4 bg-[var(--color-garuda-900)]">
                  <div className="text-red-500 text-sm">{error}</div>
                  <button onClick={loadGraphData} className="btn btn-sm btn-primary">Try Reconnecting</button>
                </div>
              )}

              {/* Canvas viewport */}
              <canvas
                ref={canvasRef}
                width={1200}
                height={800}
                className="w-full h-auto cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onDoubleClick={handleDoubleClick}
              />

              {/* Tip info bar */}
              <div className="absolute bottom-3 left-4 text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>
                Drag nodes to reposition. Click a node to select. Double-click to open full dossier profile.
              </div>
            </div>
          </div>

          {/* Details / Node Profile Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {selectedNode ? (
              <div className="card p-5 space-y-4 flex flex-col justify-between" style={{ minHeight: '480px' }}>
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${formatRiskBadge(selectedNode.risk_score)}`}>
                        {selectedNode.risk_score} Risk
                      </span>
                      <h3 className="text-lg font-bold mt-2" style={{ color: 'var(--color-garuda-100)' }}>{selectedNode.name}</h3>
                      {selectedNode.alias && (
                        <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>Alias: "{selectedNode.alias}"</p>
                      )}
                    </div>
                  </div>

                  <hr style={{ borderColor: 'var(--color-garuda-700)' }} />

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-garuda-400)' }}>Assigned Role</label>
                      <span className="text-sm font-semibold inline-flex items-center gap-1.5 mt-1" style={{ color: NODE_COLORS[selectedNode.category] }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: NODE_COLORS[selectedNode.category] }} />
                        {selectedNode.category}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-garuda-400)' }}>PageRank Hub Score</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-sm font-bold text-indigo-500">{selectedNode.pagerank || '0.000'}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>(Python PageRank Centrality)</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--color-garuda-400)' }}>Degree Centrality</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-sm font-bold text-emerald-500">{selectedNode.centrality || '0.000'}</span>
                        <span className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>(Direct Link Proportion)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  {selectedNode.pinned && (
                    <button 
                      onClick={() => {
                        selectedNode.pinned = false;
                        selectedNode.vx = (Math.random() - 0.5) * 4;
                        selectedNode.vy = (Math.random() - 0.5) * 4;
                        // force a minor position kick to update
                        selectedNode.x += selectedNode.vx;
                        selectedNode.y += selectedNode.vy;
                      }}
                      className="w-full btn btn-sm btn-primary text-xs"
                    >
                      Resume Physics (Unpin)
                    </button>
                  )}
                  <button 
                    onClick={() => navigate(`/offenders/${selectedNode.id}`)}
                    className="w-full btn btn-sm btn-secondary text-xs"
                  >
                    View Offender Dossier
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-6 flex flex-col justify-center items-center text-center" style={{ minHeight: '480px' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-[var(--color-garuda-600)]" style={{ color: 'var(--color-garuda-400)' }}>
                  <IconNetwork size={24} />
                </div>
                <h4 className="text-sm font-bold" style={{ color: 'var(--color-garuda-200)' }}>No Suspect Selected</h4>
                <p className="text-xs max-w-[200px] mt-1.5 mx-auto" style={{ color: 'var(--color-garuda-400)' }}>
                  Click on any node in the network graph viewport to load telemetry, PageRank stats, and dossier references.
                </p>
              </div>
            )}

            {/* Suspect Role Legend Card */}
            <div className="card p-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Suspect Role Legend</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {NODE_TYPES.map(n => (
                  <div key={n.type} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: NODE_COLORS[n.type] || NODE_COLORS['Unknown'] }} />
                    <span className="text-[11px]" style={{ color: 'var(--color-garuda-300)' }}>{n.type}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. Network Clusters (Duplicate Phone/IMEI Correlation logs) */}
      {activeTab === 'clusters' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Duplicate Phones */}
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  Duplicate Contact Matches
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>Identified when multiple suspects register the same phone number</p>
              </div>
              <span className="badge font-mono bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-full">
                {duplicates.total_phone_correlations} clusters
              </span>
            </div>

            {dupLoading ? (
              <div className="text-center text-xs py-12" style={{ color: 'var(--color-garuda-400)' }}>Checking primary/secondary telephone links...</div>
            ) : duplicates.duplicate_phones.length === 0 ? (
              <div className="text-center text-xs py-12 border border-dashed rounded-xl border-[var(--color-garuda-700)] text-[var(--color-garuda-400)] bg-[var(--color-garuda-600)]">
                No active mobile correlations identified in system database
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {duplicates.duplicate_phones.map((cluster, i) => (
                  <div key={i} className="p-4 rounded-xl space-y-2 bg-[var(--color-garuda-600)] border border-[var(--color-garuda-700)]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-garuda-100)' }}>{cluster.contact}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                        {cluster.match_count} Linked Suspects
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {cluster.offenders.map((off, j) => (
                        <div key={j} className="flex justify-between items-center text-xs p-1.5 rounded transition-all hover:bg-[var(--color-garuda-700)]">
                          <span style={{ color: 'var(--color-garuda-300)' }} className="font-medium">{off.name}</span>
                          <button 
                            onClick={() => navigate(`/offenders/${off.id}`)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                          >
                            View Dossier
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Duplicate IMEIs */}
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Duplicate IMEI Devices
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>Identified when multiple suspects use or have swap history with the same IMEI</p>
              </div>
              <span className="badge font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full">
                {duplicates.total_imei_correlations} clusters
              </span>
            </div>

            {dupLoading ? (
              <div className="text-center text-xs py-12" style={{ color: 'var(--color-garuda-400)' }}>Checking digital surveillance device logs...</div>
            ) : duplicates.duplicate_imeis.length === 0 ? (
              <div className="text-center text-xs py-12 border border-dashed rounded-xl border-[var(--color-garuda-700)] text-[var(--color-garuda-400)] bg-[var(--color-garuda-600)]">
                No active device/IMEI swaps or shared logs registered
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {duplicates.duplicate_imeis.map((cluster, i) => (
                  <div key={i} className="p-4 rounded-xl space-y-2 bg-[var(--color-garuda-600)] border border-[var(--color-garuda-700)]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-garuda-100)' }}>IMEI: {cluster.imei}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                        {cluster.match_count} Linked Suspects
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {cluster.offenders.map((off, j) => (
                        <div key={j} className="flex justify-between items-center text-xs p-1.5 rounded transition-all hover:bg-[var(--color-garuda-700)]">
                          <span style={{ color: 'var(--color-garuda-300)' }} className="font-medium">{off.name}</span>
                          <button 
                            onClick={() => navigate(`/offenders/${off.id}`)}
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            View Dossier
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Kingpin Profiling (Centrality Ranking and Risk Classifier Form) */}
      {activeTab === 'kingpin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Centrality Listing */}
          <div className="lg:col-span-2 card p-6 space-y-4">
            <div>
              <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                <IconShield size={18} color="#ef4444" />
                FastAPI Key Network Hub Ranking
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>Offenders sorted by PageRank scores to identify network central figures</p>
            </div>

            <div className="border rounded-xl overflow-hidden border-[var(--color-garuda-700)]">
              <table className="min-w-full divide-y text-xs border-[var(--color-garuda-700)] divide-[var(--color-garuda-700)]">
                <thead className="uppercase tracking-wider font-bold bg-[var(--color-garuda-600)]" style={{ color: 'var(--color-garuda-200)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left">Suspect</th>
                    <th className="px-4 py-3 text-left">Current Role</th>
                    <th className="px-4 py-3 text-right">PageRank Score</th>
                    <th className="px-4 py-3 text-right">Degree Centrality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-garuda-700)]" style={{ color: 'var(--color-garuda-300)' }}>
                  {nodes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-400)' }}>No data loaded. Refresh graph first.</td>
                    </tr>
                  ) : (
                    [...nodes]
                      .sort((a, b) => (b.pagerank || 0) - (a.pagerank || 0))
                      .map((node, i) => (
                        <tr key={i} className="transition-all cursor-pointer hover:bg-[var(--color-garuda-600)]" onClick={() => navigate(`/offenders/${node.id}`)}>
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
                            {node.name} {node.alias && <span className="text-[10px] font-normal" style={{ color: 'var(--color-garuda-400)' }}>({node.alias})</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: NODE_COLORS[node.category] }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: NODE_COLORS[node.category] }} />
                              {node.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-indigo-500">{node.pagerank || '0.0000'}</td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-500">{node.centrality || '0.0000'}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Predictive risk scoring card */}
          <div className="card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-md font-bold" style={{ color: 'var(--color-garuda-100)' }}>AI / Heuristic Risk Calculator</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>Calculates risk metrics utilizing demographic and criminology heuristics</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Suspect Age</label>
                  <input
                    type="number"
                    value={predictAge}
                    onChange={(e) => setPredictAge(e.target.value)}
                    className="input w-full text-xs py-1.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Assigned Role</label>
                  <select
                    value={predictCategory}
                    onChange={(e) => setPredictCategory(e.target.value)}
                    className="select w-full text-xs py-1.5 focus:outline-none"
                  >
                    <option value="KINGPIN">Kingpin</option>
                    <option value="LOCAL_SUPPLIER">Local Supplier</option>
                    <option value="INTERSTATE_SUPPLIER">Interstate Supplier</option>
                    <option value="TRANSPORTER">Transporter</option>
                    <option value="PEDDLER">Peddler</option>
                    <option value="CONSUMER">Consumer</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Previous NDPS Cases Count</label>
                  <input
                    type="number"
                    value={predictPriors}
                    onChange={(e) => setPredictPriors(e.target.value)}
                    className="input w-full text-xs py-1.5 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Contraband Quantity (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={predictQuantity}
                    onChange={(e) => setPredictQuantity(e.target.value)}
                    className="input w-full text-xs py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={runPredictor} 
                disabled={predictLoading}
                className="w-full btn btn-sm btn-primary text-xs"
              >
                {predictLoading ? 'Evaluating heuristics...' : 'Calculate Risk Rating'}
              </button>
            </div>

            {predictResult && (
              <div className="mt-4 p-4 rounded-xl space-y-3 animate-fade-in text-xs bg-[var(--color-garuda-600)] border border-[var(--color-garuda-700)]">
                <div className="flex justify-between items-center">
                  <span className="font-bold" style={{ color: 'var(--color-garuda-300)' }}>Risk Score Output:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${formatRiskBadge(predictResult.risk_score)}`}>
                    {predictResult.risk_score}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-bold" style={{ color: 'var(--color-garuda-300)' }}>Model Confidence:</span>
                  <span className="font-mono text-emerald-500 font-bold">{Math.round(predictResult.confidence * 100)}%</span>
                </div>
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Contributing Factors</div>
                  {predictResult.factors.map((factor, idx) => (
                    <div key={idx} style={{ color: 'var(--color-garuda-300)' }} className="text-[10px] list-disc pl-2">
                      • {factor}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {predictError && (
              <div className="mt-4 p-3 rounded-xl text-xs bg-red-500/10 text-red-500 border border-red-500/20">
                {predictError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Interstate Links */}
      {activeTab === 'interstate' && (
        <div className="card p-6 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                <IconMap size={18} color="#0891b2" />
                Interstate Link Mapping
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
                Transit routes from source states/areas feeding local supply networks
              </p>
            </div>
            <button 
              onClick={loadInterstateData}
              className="btn btn-sm btn-secondary text-xs cursor-pointer"
            >
              Refresh Routes
            </button>
          </div>

          {interstateLoading ? (
            <div className="text-center text-xs py-12" style={{ color: 'var(--color-garuda-400)' }}>Querying interstate seizure matrix...</div>
          ) : interstateData.length === 0 ? (
            <div className="text-center text-xs py-12 border border-dashed rounded-xl border-[var(--color-garuda-700)] text-[var(--color-garuda-400)] bg-[var(--color-garuda-600)]">
              No historical interstate route linkages recorded in the system. Make sure case source/destination locations are entered.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden border-[var(--color-garuda-700)] overflow-x-auto">
              <table className="min-w-full divide-y text-xs border-[var(--color-garuda-700)] divide-[var(--color-garuda-700)]">
                <thead className="uppercase tracking-wider font-bold bg-[var(--color-garuda-600)]" style={{ color: 'var(--color-garuda-200)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left">Source Location</th>
                    <th className="px-4 py-3 text-left">Destination Location</th>
                    <th className="px-4 py-3 text-left">Contraband Type</th>
                    <th className="px-4 py-3 text-right">Case Count</th>
                    <th className="px-4 py-3 text-right">Total Seized</th>
                    <th className="px-4 py-3 text-right">Est. Street Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-garuda-700)]" style={{ color: 'var(--color-garuda-300)' }}>
                  {interstateData.map((route, i) => (
                    <tr key={i} className="hover:bg-[var(--color-garuda-600)]">
                      <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{route.source}</td>
                      <td className="px-4 py-3">{route.destination}</td>
                      <td className="px-4 py-3 font-mono">{route.contraband_type}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-400">{route.case_count}</td>
                      <td className="px-4 py-3 text-right font-mono">{route.total_quantity.toFixed(2)} kg</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">₹{route.total_street_value.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Consignment Trail */}
      {activeTab === 'consignment' && (
        <div className="card p-6 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                <IconPackage size={18} color="#f59e0b" />
                Consignment Trail Logs
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
                Shipment logs tracing contraband cargo from source to intercepting police station
              </p>
            </div>
            <button 
              onClick={loadConsignmentData}
              className="btn btn-sm btn-secondary text-xs cursor-pointer"
            >
              Refresh Consignments
            </button>
          </div>

          {consignmentLoading ? (
            <div className="text-center text-xs py-12" style={{ color: 'var(--color-garuda-400)' }}>Querying consignment trail logs...</div>
          ) : consignmentData.length === 0 ? (
            <div className="text-center text-xs py-12 border border-dashed rounded-xl border-[var(--color-garuda-700)] text-[var(--color-garuda-400)] bg-[var(--color-garuda-600)]">
              No shipment trail logs registered in system database.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden border-[var(--color-garuda-700)] overflow-x-auto">
              <table className="min-w-full divide-y text-xs border-[var(--color-garuda-700)] divide-[var(--color-garuda-700)]">
                <thead className="uppercase tracking-wider font-bold bg-[var(--color-garuda-600)]" style={{ color: 'var(--color-garuda-200)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left">FIR No</th>
                    <th className="px-4 py-3 text-left">Station / Unit</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Transit Route</th>
                    <th className="px-4 py-3 text-left">Contraband Details</th>
                    <th className="px-4 py-3 text-right">Seized Quantity</th>
                    <th className="px-4 py-3 text-right">Street Value</th>
                    <th className="px-4 py-3 text-left">Linked Accused</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-garuda-700)]" style={{ color: 'var(--color-garuda-300)' }}>
                  {consignmentData.map((trail, i) => (
                    <tr key={i} className="hover:bg-[var(--color-garuda-600)] transition-all cursor-pointer" onClick={() => navigate(`/cases/${trail.case_id}`)}>
                      <td className="px-4 py-3 font-semibold text-indigo-400 hover:underline">{trail.fir_no}</td>
                      <td className="px-4 py-3">{trail.ps_name}</td>
                      <td className="px-4 py-3 font-mono">{trail.case_date ? new Date(trail.case_date).toLocaleDateString('en-IN') : '—'}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <span className="text-gray-400">{trail.source}</span> → <span className="text-emerald-400">{trail.destination}</span>
                      </td>
                      <td className="px-4 py-3">{trail.contraband_type}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{trail.quantity} kg</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">₹{trail.street_value.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {trail.accused_names.length === 0 ? (
                            <span className="text-gray-500">—</span>
                          ) : (
                            trail.accused_names.map((name, idx) => (
                              <span key={idx} className="bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px] text-gray-300 border border-slate-600/30">
                                {name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Case Linkage */}
      {activeTab === 'linkage' && (
        <div className="card p-6 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-md font-bold flex items-center gap-2" style={{ color: 'var(--color-garuda-100)' }}>
                <IconCases size={18} color="#8b5cf6" />
                Case Linkage Index (Section 29 Conspiracy)
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
                Highlights repeat offenders linked across multiple FIRs, crucial for building conspiracy networks
              </p>
            </div>
            <button 
              onClick={loadLinkageData}
              className="btn btn-sm btn-secondary text-xs cursor-pointer"
            >
              Refresh Linkages
            </button>
          </div>

          {linkageLoading ? (
            <div className="text-center text-xs py-12" style={{ color: 'var(--color-garuda-400)' }}>Identifying overlapping suspect cases...</div>
          ) : linkageData.length === 0 ? (
            <div className="text-center text-xs py-12 border border-dashed rounded-xl border-[var(--color-garuda-700)] text-[var(--color-garuda-400)] bg-[var(--color-garuda-600)]">
              No overlapping offenders (suspects with 2+ cases) identified in current database.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {linkageData.map((linkage, i) => (
                <div key={i} className="p-5 rounded-2xl border flex flex-col justify-between bg-[var(--color-garuda-600)] border-[var(--color-garuda-700)] hover:border-[var(--color-garuda-500)] transition-all">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-[var(--color-garuda-100)] flex items-center gap-2">
                          {linkage.offender_name}
                          {linkage.alias && <span className="text-xs font-normal text-gray-400">({linkage.alias})</span>}
                        </h3>
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium" style={{ color: NODE_COLORS[linkage.category] || NODE_COLORS['Unknown'] }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: NODE_COLORS[linkage.category] || NODE_COLORS['Unknown'] }} />
                          {linkage.category}
                        </span>
                      </div>
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full">
                        {linkage.case_count} Cases Linked
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Linked Cases History</div>
                      <div className="space-y-2">
                        {linkage.linked_cases.map((caseItem, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border flex justify-between items-center text-xs bg-[var(--color-garuda-800)] border-[var(--color-garuda-700)] hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => navigate(`/cases/${caseItem.case_id}`)}>
                            <div>
                              <div className="font-semibold text-indigo-400 hover:underline">{caseItem.fir_no}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{caseItem.ps_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-gray-300">{caseItem.contraband_type}</div>
                              <div className="text-[9px] text-gray-400 mt-0.5">{caseItem.stage}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/offenders/${linkage.offender_id}`)}
                    className="w-full btn btn-sm btn-secondary text-xs mt-5 cursor-pointer"
                  >
                    View Offender Dossier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
