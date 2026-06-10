import React, { useState, useEffect } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import VillageVisitForm from '../components/enforcement/forms/VillageVisitForm';
import LodgeCheckForm from '../components/enforcement/forms/LodgeCheckForm';
import NdpsVerificationForm from '../components/enforcement/forms/NdpsVerificationForm';

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
    { id: 'village_visit', title: 'Village Visit', icon: '🏠', desc: 'Geo-tagged visits, rowdy checks, palle nidra' },
    { id: 'rowdy_sheeter', title: 'Rowdy Sheeter', icon: '👤', desc: 'Verify bad characters, associates, employment' },
    { id: 'bound_over', title: 'Bound Over', icon: '📜', desc: 'MEM court orders, compliance, violations' },
    { id: 'ndps_verification', title: 'Ganja / NDPS', icon: '🌿', desc: 'Consumer & old accused verification, drug tests' },
    { id: 'lodge_check', title: 'Lodge Check', icon: '🏨', desc: 'Guest registers, strangers, suspicious occupants' },
    { id: 'courier_check', title: 'Courier Office', icon: '📦', desc: 'Parcel source, destination, suspicious consignments' },
    { id: 'railway_check', title: 'Railway Station', icon: '🚆', desc: 'Passenger profiling, suspicious luggage' },
    { id: 'bus_stand_check', title: 'Bus Stand', icon: '🚌', desc: 'Passenger & parcel verification, suspect movement' },
    { id: 'vehicle_check', title: 'Vehicle Check', icon: '🚗', desc: 'Driver details, NDPS & criminal watchlist' },
    { id: 'drunk_drive', title: 'Drunk & Drive', icon: '🍻', desc: 'BAC levels, repeat offenders analytics' },
    { id: 'mv_act', title: 'MV Act', icon: '📋', desc: 'Violation type, fine amount, high-risk zones' },
    { id: 'petty_cases', title: 'Petty Cases', icon: '⚖️', desc: 'Public nuisance, obstruction, disorder' },
    { id: 'palle_nidra', title: 'Palle Nidra', icon: '🌙', desc: 'Public grievances, intelligence collection' },
    { id: 'drone_surveillance', title: 'Drone Surveillance', icon: '🚁', desc: 'Ganja cultivation detection, forest surveillance' },
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
            <span>📱</span>
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
                if (mod.id === 'village_visit' || mod.id === 'lodge_check' || mod.id === 'ndps_verification') {
                  setActiveForm(mod.id);
                  setActiveTab('form');
                } else {
                  alert(`Form for ${mod.title} is not yet implemented in Phase 1.`);
                }
              }}
            >
              <div className="text-4xl mb-3">{mod.icon}</div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-garuda-100)' }}>{mod.title}</h3>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{mod.desc}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'form' && activeForm === 'village_visit' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}><span>🏠</span> Log Village Visit</h2>
          <VillageVisitForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'lodge_check' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}><span>🏨</span> Log Lodge Check</h2>
          <LodgeCheckForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
        </div>
      )}

      {activeTab === 'form' && activeForm === 'ndps_verification' && (
        <div className="card p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--color-garuda-50)' }}><span>🌿</span> NDPS Verification</h2>
          <NdpsVerificationForm onCancel={() => { setActiveTab('hub'); setActiveForm(null); }} onSuccess={() => { setActiveTab('hub'); setActiveForm(null); }} />
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Village Visits', value: villageVisitsCount, trend: '+12%', color: 'blue' },
          { label: 'Lodge Checks', value: lodgeChecksCount, trend: '+5%', color: 'green' },
          { label: 'NDPS Verifications', value: ndpsChecksCount, trend: '+18%', color: 'purple' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-5 animate-fade-in" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>{kpi.label}</h3>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-3xl font-bold" style={{ color: 'var(--color-garuda-100)' }}>{kpi.value}</span>
              <span className={`text-sm font-bold pb-1 text-${kpi.color}-400`}>{kpi.trend}</span>
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
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm" style={{ color: 'var(--color-garuda-400)' }}>
                      No station data logged this month.
                    </td>
                  </tr>
                ) : (
                  leaderboard.slice(0, 5).map((st, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-garuda-800)' }}>
                      <td className="py-3 text-sm font-medium text-gray-200">{st.ps_name}</td>
                      <td className="py-3 text-sm font-semibold text-blue-400 text-right">{st.visits}</td>
                      <td className="py-3 text-sm font-semibold text-purple-400 text-right">{st.lodges}</td>
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
