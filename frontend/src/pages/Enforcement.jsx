import React, { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import VillageVisitForm from '../components/enforcement/forms/VillageVisitForm';
import LodgeCheckForm from '../components/enforcement/forms/LodgeCheckForm';
import NdpsVerificationForm from '../components/enforcement/forms/NdpsVerificationForm';
import DrunkDriveForm from '../components/enforcement/forms/DrunkDriveForm';
import CourierCheckForm from '../components/enforcement/forms/CourierCheckForm';
import RailwayCheckForm from '../components/enforcement/forms/RailwayCheckForm';
import BusStandCheckForm from '../components/enforcement/forms/BusStandCheckForm';

export default function Enforcement() {
  const perms = usePermissions();
  // SDPO, ASP, SP see the command dashboard
  const isCommandLevel = perms.hasMinRole('SDPO'); 
  // SHO, CONSTABLE see the field hub
  const isFieldLevel = !isCommandLevel || perms.isSHO || perms.role === 'CONSTABLE';

  // State to manage which view is active if the user has access to both (optional, but good for testing)
  const [activeView, setActiveView] = useState(isCommandLevel ? 'dashboard' : 'field_hub');

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border"
        style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.05))',
          borderColor: 'rgba(59, 130, 246, 0.2)',
        }}
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Preventive Enforcement
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Digitize, monitor, geo-tag, and analyze preventive policing activities.
          </p>
        </div>

        {/* View Toggle (Only for roles that might want to switch, e.g. SDPO testing field views or SP doing everything) */}
        {isCommandLevel && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${activeView === 'dashboard' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-400 border-gray-700 hover:bg-gray-800'}`}
            >
              Command Dashboard
            </button>
            <button
              onClick={() => setActiveView('field_hub')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${activeView === 'field_hub' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-transparent text-gray-400 border-gray-700 hover:bg-gray-800'}`}
            >
              Field Operations Hub
            </button>
          </div>
        )}
      </div>

      {activeView === 'dashboard' ? <GarudaCommandDashboard /> : <FieldOperationsHub perms={perms} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FIELD OPERATIONS HUB (For Constables & SHOs)
// ─────────────────────────────────────────────────────────────────────────
function FieldOperationsHub({ perms }) {
  const [activeTab, setActiveTab] = useState('hub'); // 'hub' | 'form'
  const [activeForm, setActiveForm] = useState(null);

  const modules = [
    { 
      id: 'village_visit', 
      title: 'Village Visit', 
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ), 
      desc: 'Geo-tagged visits, rowdy checks, palle nidra' 
    },
    { 
      id: 'rowdy_sheeter', 
      title: 'Rowdy Sheeter', 
      icon: (
        <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ), 
      desc: 'Verify bad characters, associates, employment' 
    },
    { 
      id: 'bound_over', 
      title: 'Bound Over', 
      icon: (
        <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ), 
      desc: 'MEM court orders, compliance, violations' 
    },
    { 
      id: 'ndps_verification', 
      title: 'Ganja / NDPS', 
      icon: (
        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ), 
      desc: 'Consumer & old accused verification, drug tests' 
    },
    { 
      id: 'lodge_check', 
      title: 'Lodge Check', 
      icon: (
        <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ), 
      desc: 'Guest registers, strangers, suspicious occupants' 
    },
    { 
      id: 'courier_check', 
      title: 'Courier Office', 
      icon: (
        <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ), 
      desc: 'Parcel source, destination, suspicious consignments' 
    },
    { 
      id: 'railway_check', 
      title: 'Railway Station', 
      icon: (
        <svg className="w-8 h-8 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm2 14v2m10-2v2m-9-10h8m-8 4h8" />
        </svg>
      ), 
      desc: 'Passenger profiling, suspicious luggage' 
    },
    { 
      id: 'bus_stand_check', 
      title: 'Bus Stand', 
      icon: (
        <svg className="w-8 h-8 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-8 0V4a2 2 0 012-2h4a2 2 0 012 2v3m-8 0h8m-6 8h4" />
        </svg>
      ), 
      desc: 'Passenger & parcel verification, suspect movement' 
    },
    { 
      id: 'vehicle_check', 
      title: 'Vehicle Check', 
      icon: (
        <svg className="w-8 h-8 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zm-2 1h-6m-4-6h12l-1-4H6l-1 4zm-3-2V8m12 2V8" />
        </svg>
      ), 
      desc: 'Driver details, NDPS & criminal watchlist' 
    },
    { 
      id: 'drunk_drive', 
      title: 'Drunk & Drive', 
      icon: (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ), 
      desc: 'BAC levels, repeat offenders analytics' 
    },
    { 
      id: 'mv_act', 
      title: 'MV Act', 
      icon: (
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ), 
      desc: 'Violation type, fine amount, high-risk zones' 
    },
    { 
      id: 'petty_cases', 
      title: 'Petty Cases', 
      icon: (
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7V3m0 0h12m0 0v4m0-4v14m0-14l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9h-6m-2 10h4a2 2 0 012 2v1h-8v-1a2 2 0 012-2z" />
        </svg>
      ), 
      desc: 'Public nuisance, obstruction, disorder' 
    },
    { 
      id: 'palle_nidra', 
      title: 'Palle Nidra', 
      icon: (
        <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ), 
      desc: 'Public grievances, intelligence collection' 
    },
    { 
      id: 'drone_surveillance', 
      title: 'Drone Surveillance', 
      icon: (
        <svg className="w-8 h-8 text-fuchsia-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ), 
      desc: 'Ganja cultivation detection, forest surveillance' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs / Back Button */}
      {activeTab === 'form' && (
        <button
          onClick={() => { setActiveTab('hub'); setActiveForm(null); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-gray-800 rounded-lg w-fit transition-colors"
        >
          <span>←</span> Back to Hub
        </button>
      )}

      {activeTab === 'hub' && (
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer border-none bg-blue-600 text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
            </svg>
            <span>Field Modules</span>
          </button>
        </div>
      )}

      {activeTab === 'hub' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {modules.map((mod) => (
            <div 
              key={mod.id} 
              className="card p-5 cursor-pointer hover:-translate-y-1 transition-transform duration-200" 
              style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }} 
              onClick={() => {
                if (
                  mod.id === 'village_visit' || 
                  mod.id === 'lodge_check' || 
                  mod.id === 'ndps_verification' || 
                  mod.id === 'drunk_drive' || 
                  mod.id === 'courier_check' || 
                  mod.id === 'railway_check' || 
                  mod.id === 'bus_stand_check'
                ) {
                  setActiveForm(mod.id);
                  setActiveTab('form');
                } else {
                  alert(`Form for ${mod.title} is not yet implemented in Phase 1.`);
                }
              }}
            >
              <div className="mb-3">{mod.icon}</div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-garuda-100)' }}>{mod.title}</h3>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{mod.desc}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'form' && activeForm === 'village_visit' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v11a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Log Village Visit
          </h2>
          <VillageVisitForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'lodge_check' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Log Lodge Check
          </h2>
          <LodgeCheckForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'ndps_verification' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            NDPS Verification
          </h2>
          <NdpsVerificationForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'drunk_drive' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Log Drunk & Drive Check
          </h2>
          <DrunkDriveForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'courier_check' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Log Courier Office Check
          </h2>
          <CourierCheckForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'railway_check' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zm2 14v2m10-2v2m-9-10h8m-8 4h8" />
            </svg>
            Log Railway Station Check
          </h2>
          <RailwayCheckForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'bus_stand_check' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}>
            <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-8 0V4a2 2 0 012-2h4a2 2 0 012 2v3m-8 0h8m-6 8h4" />
            </svg>
            Log Bus Stand Check
          </h2>
          <BusStandCheckForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GARUDA COMMAND DASHBOARD (For SDPO, ASP, SP)
// ─────────────────────────────────────────────────────────────────────────
function GarudaCommandDashboard() {
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [stations, setStations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch actual police stations from database
    const fetchStations = async () => {
      try {
        const res = await api.get('/police-stations');
        setStations(res.data.data?.stations || res.data.data || []);
      } catch (err) {
        console.error('Failed to fetch stations:', err);
      }
    };
    fetchStations();
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/enforcement/summary?psId=${selectedStation}`);
        setSummary(res.data.data || null);
      } catch (err) {
        console.error('Failed to fetch enforcement summary:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummary();
  }, [selectedStation]);

  const villageVisitsCount = summary?.thisMonth?.villageVisits || 0;
  const lodgeChecksCount = summary?.thisMonth?.lodgeChecks || 0;
  const ndpsChecksCount = summary?.thisMonth?.total || 0;
  const drunkDriveCount = summary?.thisMonth?.drunkDrive || 0;
  const courierCount = summary?.thisMonth?.courier || 0;
  const railwayCount = summary?.thisMonth?.railway || 0;
  const busCount = summary?.thisMonth?.bus || 0;

  // Dynamic mock weekly data scaled to actual current counts
  const data = [
    { name: 'Mon', visits: Math.round(villageVisitsCount * 0.15), lodges: Math.round(lodgeChecksCount * 0.1) },
    { name: 'Tue', visits: Math.round(villageVisitsCount * 0.1), lodges: Math.round(lodgeChecksCount * 0.15) },
    { name: 'Wed', visits: Math.round(villageVisitsCount * 0.2), lodges: Math.round(lodgeChecksCount * 0.2) },
    { name: 'Thu', visits: Math.round(villageVisitsCount * 0.12), lodges: Math.round(lodgeChecksCount * 0.12) },
    { name: 'Fri', visits: Math.round(villageVisitsCount * 0.18), lodges: Math.round(lodgeChecksCount * 0.18) },
    { name: 'Sat', visits: Math.round(villageVisitsCount * 0.15), lodges: Math.round(lodgeChecksCount * 0.15) },
    { name: 'Sun', visits: Math.round(villageVisitsCount * 0.1), lodges: Math.round(lodgeChecksCount * 0.1) },
  ];

  const pieData = [
    { name: 'Village Visits', value: villageVisitsCount, color: '#3b82f6' },
    { name: 'Lodge Checks', value: lodgeChecksCount, color: '#8b5cf6' },
    { name: 'NDPS Verification', value: ndpsChecksCount, color: '#f59e0b' },
    { name: 'Drunk & Drive', value: drunkDriveCount, color: '#ef4444' },
    { name: 'Courier Checks', value: courierCount, color: '#ec4899' },
    { name: 'Railway Checks', value: railwayCount, color: '#06b6d4' },
    { name: 'Bus Stand Checks', value: busCount, color: '#20b8a6' },
  ].filter(p => p.value > 0);

  const displayPieData = pieData.length > 0 ? pieData : [
    { name: 'No Activity', value: 1, color: '#4b5563' }
  ];

  const recentActivities = summary?.recentActivities || [];
  const leaderboard = summary?.stationBreakdown || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-300)' }}>Loading Dashboard Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Station Filter for Command Level */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-garuda-100)' }}>
          Command Overview {selectedStation !== 'ALL' && `- ${stations.find(s => String(s.id) === String(selectedStation))?.name || selectedStation}`}
        </h2>
        <select
          value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm border font-semibold outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          style={{ background: 'var(--color-garuda-800)', borderColor: 'var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
        >
          <option value="ALL">All Stations (District-wide)</option>
          {stations.map(station => (
            <option key={station.id} value={station.id}>
              {station.name}
            </option>
          ))}
        </select>
      </div>

      {/* High-level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {[
          { label: 'Village Visits', value: villageVisitsCount, trend: '+12%', color: 'text-blue-400' },
          { label: 'Lodge Checks', value: lodgeChecksCount, trend: '+5%', color: 'text-purple-400' },
          { label: 'NDPS Verifications', value: ndpsChecksCount, trend: '+18%', color: 'text-amber-400' },
          { label: 'Drunk & Drive', value: drunkDriveCount, trend: '+8%', color: 'text-red-400' },
          { label: 'Courier Checks', value: courierCount, trend: '+10%', color: 'text-pink-400' },
          { label: 'Railway Checks', value: railwayCount, trend: '+6%', color: 'text-cyan-400' },
          { label: 'Bus Stand Checks', value: busCount, trend: '+7%', color: 'text-teal-400' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-5 animate-fade-in" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>{kpi.label}</h3>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-2xl font-bold" style={{ color: 'var(--color-garuda-100)' }}>{kpi.value}</span>
              <span className={`text-[10px] font-bold pb-1 ${kpi.color}`}>{kpi.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Chart & Alerts Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Weekly Field Activities</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: 'var(--color-garuda-700)', opacity: 0.2 }} contentStyle={{ backgroundColor: 'var(--color-garuda-800)', borderColor: 'var(--color-garuda-700)', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'var(--color-garuda-100)' }} itemStyle={{ color: 'var(--color-garuda-200)' }} />
                <Bar dataKey="visits" stackId="a" fill="#3b82f6" name="Village Visits" radius={[0, 0, 4, 4]} />
                <Bar dataKey="lodges" stackId="a" fill="#8b5cf6" name="Lodge Checks" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Distribution Pie Chart */}
        <div className="card p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Activity Distribution</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={displayPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {displayPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: 'var(--color-garuda-800)', borderColor: 'var(--color-garuda-700)', borderRadius: '8px', fontSize: '12px' }} labelStyle={{ color: 'var(--color-garuda-100)' }} itemStyle={{ color: 'var(--color-garuda-200)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities Log */}
        <div className="lg:col-span-2 card p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Recent Field Activities</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--color-garuda-400)' }}>Latest logs of preventive work completed by officers.</p>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {recentActivities.length === 0 ? (
              <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-garuda-900)' }}>
                <p className="text-sm" style={{ color: 'var(--color-garuda-400)' }}>No recent activity logs found.</p>
              </div>
            ) : (
              recentActivities.map((log, i) => (
                <div key={i} className="p-3 rounded-lg border animate-fade-in" style={{ background: 'var(--color-garuda-900)', borderColor: 'var(--color-garuda-700)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: log.bg, color: log.color }}>{log.type}</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-garuda-500)' }}>
                      {new Date(log.time).toLocaleDateString()} at {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm font-semibold mt-1" style={{ color: 'var(--color-garuda-200)' }}>{log.officer}</div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>{log.result} • <span style={{ color: 'var(--color-garuda-500)' }}>{log.psName}</span></p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Performing Stations */}
        <div className="card p-5" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Station Leaderboard</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--color-garuda-400)' }}>Top stations by volume of preventive checks.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                  <th className="pb-2 text-xs font-semibold text-gray-400">Station</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Visits</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Lodges</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">NDPS</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Drunk Drive</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Courier</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Railway</th>
                  <th className="pb-2 text-xs font-semibold text-gray-400 text-right">Bus Stand</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-sm" style={{ color: 'var(--color-garuda-400)' }}>
                      No station data logged this month.
                    </td>
                  </tr>
                ) : (
                  leaderboard.slice(0, 5).map((st, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-garuda-800)' }}>
                      <td className="py-3 text-sm font-medium text-gray-200">{st.ps_name}</td>
                      <td className="py-3 text-sm font-semibold text-blue-400 text-right">{st.visits}</td>
                      <td className="py-3 text-sm font-semibold text-purple-400 text-right">{st.lodges}</td>
                      <td className="py-3 text-sm font-semibold text-amber-500 text-right">{st.ndps || 0}</td>
                      <td className="py-3 text-sm font-semibold text-red-500 text-right">{st.drunkDrive || 0}</td>
                      <td className="py-3 text-sm font-semibold text-rose-400 text-right">{st.courier || 0}</td>
                      <td className="py-3 text-sm font-semibold text-cyan-400 text-right">{st.railway || 0}</td>
                      <td className="py-3 text-sm font-semibold text-teal-400 text-right">{st.bus || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
