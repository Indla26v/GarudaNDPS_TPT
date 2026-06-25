/**
 * GARUDA — District Analytics Page (SP & Admin Only)
 * 
 * Real-time district-level analytics with aggregated data across all PS.
 * Shows trends, comparisons, and key metrics for SP/Admin oversight.
 */
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useSSE } from '../hooks/useSSE';
import {
  IconClipboard, IconOffender, IconLock, IconRunning, IconPackage, IconDollar, IconCar,
} from '../components/Icons';

const METRIC_CARDS = [
  { key: 'totalCases',        label: 'Total Cases',     Icon: IconClipboard, color: '#3b82f6' },
  { key: 'totalOffenders',    label: 'Total Offenders',  Icon: IconOffender,  color: '#8b5cf6' },
  { key: 'totalArrests',      label: 'Total Arrests',    Icon: IconLock,      color: '#22c55e' },
  { key: 'totalAbsconders',   label: 'Absconders',       Icon: IconRunning,   color: '#ef4444' },
  { key: 'totalContrabandKg', label: 'Contraband (Kg)',  Icon: IconPackage,   color: '#f59e0b' },
  { key: 'totalCashSeized',   label: 'Cash Seized (₹)',  Icon: IconDollar,    color: '#06b6d4' },
  { key: 'totalVehiclesSeized', label: 'Vehicles Seized', Icon: IconCar,      color: '#ec4899' },
];

export default function DistrictAnalytics() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lastEvent, isConnected } = useSSE();

  // Filters state (Comparison section)
  const [stationsDetails, setStationsDetails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('cases');

  // Filters & Sorting state (Detailed Breakdown Table)
  const [tableSearch, setTableSearch] = useState('');
  const [tableDivision, setTableDivision] = useState('ALL');
  const [tableType, setTableType] = useState('ALL');
  const [tableSortField, setTableSortField] = useState('totalCases');
  const [tableSortAsc, setTableSortAsc] = useState(false);

  useEffect(() => {
    fetchSummary();
    fetchStationsDetails();
  }, []);

  // Refresh data on SSE events
  useEffect(() => {
    if (lastEvent && ['case_created', 'offender_created', 'data_updated'].includes(lastEvent.type)) {
      fetchSummary();
    }
  }, [lastEvent]);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStationsDetails = async () => {
    try {
      const res = await api.get('/police-stations');
      setStationsDetails(res.data.data || []);
    } catch (err) {
      console.error('Failed to load station details:', err);
    }
  };

  // Combine summary psWiseData with details (sdpo, station_type)
  const enrichedPsData = summary?.psWiseData?.map((ps) => {
    const details = stationsDetails.find(s => String(s.id) === String(ps.psId) || s.ps_code === ps.psCode);
    return {
      ...ps,
      sdpo: details?.sdpo || 'Other',
      stationType: details?.station_type || 'POLICE',
    };
  }) || [];

  // Extract unique divisions dynamically
  const divisionsList = Array.from(
    new Set(stationsDetails.map(s => s.sdpo).filter(Boolean))
  ).sort();

  // Filter and Sort the data
  const filteredPsData = enrichedPsData
    .filter((ps) => {
      const matchesSearch = 
        ps.psName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ps.psCode.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDivision = divisionFilter === 'ALL' || ps.sdpo === divisionFilter;
      const matchesType = typeFilter === 'ALL' || ps.stationType === typeFilter;

      return matchesSearch && matchesDivision && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'cases') return b.totalCases - a.totalCases;
      if (sortBy === 'arrests') return b.totalArrests - a.totalArrests;
      if (sortBy === 'absconders') return b.totalAbsconders - a.totalAbsconders;
      if (sortBy === 'contraband') return b.totalContrabandKg - a.totalContrabandKg;
      if (sortBy === 'cash') return b.totalCashSeized - a.totalCashSeized;
      return 0;
    });

  const handleTableSort = (field) => {
    if (tableSortField === field) {
      setTableSortAsc(!tableSortAsc);
    } else {
      setTableSortField(field);
      setTableSortAsc(false);
    }
  };

  // Filter and Sort Detailed Table Data
  const tableData = enrichedPsData
    .filter((ps) => {
      const matchesSearch = 
        ps.psName.toLowerCase().includes(tableSearch.toLowerCase()) ||
        ps.psCode.toLowerCase().includes(tableSearch.toLowerCase());
      
      const matchesDivision = tableDivision === 'ALL' || ps.sdpo === tableDivision;
      const matchesType = tableType === 'ALL' || ps.stationType === tableType;

      return matchesSearch && matchesDivision && matchesType;
    })
    .sort((a, b) => {
      const fieldA = a[tableSortField];
      const fieldB = b[tableSortField];
      
      if (typeof fieldA === 'number' && typeof fieldB === 'number') {
        return tableSortAsc ? fieldA - fieldB : fieldB - fieldA;
      }
      
      const strA = String(fieldA || '');
      const strB = String(fieldB || '');
      return tableSortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('en-IN');
  };

  const renderCardValue = (val) => {
    if (loading && !summary) {
      return <div className="w-16 h-8 bg-black/10 rounded animate-pulse" />;
    }
    return formatNumber(val);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>District Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Real-time aggregated intelligence across all Police Stations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: isConnected ? '#22c55e' : '#ef4444' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
 
      {/* Main Content Area */}
      <div className="relative min-h-[400px]">

        {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {METRIC_CARDS.map((card) => (
          <div
            key={card.key}
            className="card card-hover rounded-xl p-4 animate-slide-up"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{ background: card.color + '14' }}
            >
              <card.Icon size={18} color={card.color} />
            </div>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {renderCardValue(summary?.[card.key])}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>{card.label}</p>
          </div>
        ))}
      </div>      {/* PS Comparison Chart (table representation) */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Police Station Comparison
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>
            Showing {filteredPsData.length} of {summary?.psWiseData?.length || 0} stations
          </span>
        </div>

        {/* Interactive Filters Bar */}
        <div className="px-6 py-4 border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" style={{ borderColor: 'var(--color-garuda-700)', background: 'rgba(var(--color-garuda-600), 0.1)' }}>
          <div className="flex flex-wrap gap-3 flex-1 w-full">
            {/* Search Input */}
            <div className="w-full sm:w-60">
              <input
                type="text"
                placeholder="Search station name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input text-xs"
              />
            </div>

            {/* Division/SDPO Select */}
            <div className="w-full sm:w-48">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="select text-xs w-full"
              >
                <option value="ALL">All Divisions</option>
                {divisionsList.map((div) => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>

            {/* Station Type Select */}
            <div className="w-full sm:w-40">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="select text-xs w-full"
              >
                <option value="ALL">All Types</option>
                <option value="POLICE">Police Stations</option>
                <option value="EXCISE">Excise Stations</option>
              </select>
            </div>
          </div>

          {/* Sort Control */}
          <div className="w-full sm:w-56 flex items-center gap-2">
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--color-garuda-400)' }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="select text-xs w-full"
            >
              <option value="cases">Cases</option>
              <option value="arrests">Arrests</option>
              <option value="absconders">Absconders</option>
              <option value="contraband">Contraband</option>
              <option value="cash">Cash Seized</option>
            </select>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading && !summary ? (
            <div className="py-12 text-center text-sm text-[var(--color-garuda-400)] animate-pulse">
              Loading comparisons...
            </div>
          ) : filteredPsData.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--color-garuda-400)' }}>
              No stations match the selected filters.
            </div>
          ) : (
            filteredPsData.map((ps) => {
              const maxCases = Math.max(...filteredPsData.map(p => p.totalCases), 1);
              const percentage = (ps.totalCases / maxCases) * 100;

              return (
                <div key={ps.psId} className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                      {ps.psName}
                      <span className="text-xs ml-2 font-mono font-normal" style={{ color: 'var(--color-garuda-500)' }}>
                        {ps.psCode}
                      </span>
                    </span>
                    <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap">
                      <span style={{ color: '#2563eb' }}>{formatNumber(ps.totalCases)} cases</span>
                      <span style={{ color: '#16a34a' }}>{formatNumber(ps.totalArrests)} arrests</span>
                      <span style={{ color: '#dc2626' }}>{formatNumber(ps.totalAbsconders)} absconders</span>
                    </div>
                  </div>
                  <div
                    className="h-2 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-garuda-700)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>
            Detailed Breakdown
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>
            Showing {tableData.length} of {summary?.psWiseData?.length || 0} stations
          </span>
        </div>

        {/* Dedicated Filters for Table */}
        <div className="px-6 py-4 border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" style={{ borderColor: 'var(--color-garuda-700)', background: 'rgba(var(--color-garuda-600), 0.1)' }}>
          <div className="flex flex-wrap gap-3 flex-1 w-full">
            {/* Table Search */}
            <div className="w-full sm:w-60">
              <input
                type="text"
                placeholder="Search station name or code..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="input text-xs"
              />
            </div>

            {/* Table Division Select */}
            <div className="w-full sm:w-48">
              <select
                value={tableDivision}
                onChange={(e) => setTableDivision(e.target.value)}
                className="select text-xs w-full"
              >
                <option value="ALL">All Divisions</option>
                {divisionsList.map((div) => (
                  <option key={div} value={div}>{div}</option>
                ))}
              </select>
            </div>

            {/* Table Station Type Select */}
            <div className="w-full sm:w-40">
              <select
                value={tableType}
                onChange={(e) => setTableType(e.target.value)}
                className="select text-xs w-full"
              >
                <option value="ALL">All Types</option>
                <option value="POLICE">Police Stations</option>
                <option value="EXCISE">Excise Stations</option>
              </select>
            </div>
          </div>
          <div className="text-xs font-semibold text-[var(--color-garuda-400)]">
            💡 Click column headers to sort the table
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header select-none">
                <th className="cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('psName')}>
                  PS Name {tableSortField === 'psName' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('psCode')}>
                  Code {tableSortField === 'psCode' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalCases')}>
                  Cases {tableSortField === 'totalCases' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalOffenders')}>
                  Offenders {tableSortField === 'totalOffenders' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalArrests')}>
                  Arrests {tableSortField === 'totalArrests' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalAbsconders')}>
                  Absconders {tableSortField === 'totalAbsconders' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalContrabandKg')}>
                  Contraband (Kg) {tableSortField === 'totalContrabandKg' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
                <th className="text-right cursor-pointer hover:bg-black/10 px-4 py-3" onClick={() => handleTableSort('totalCashSeized')}>
                  Cash (₹) {tableSortField === 'totalCashSeized' ? (tableSortAsc ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !summary ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--color-garuda-400)] animate-pulse">
                    Loading breakdown table...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-garuda-400)' }}>
                    No stations match the selected filters.
                  </td>
                </tr>
              ) : (
                tableData.map((ps) => (
                  <tr
                    key={ps.psId}
                    className="table-row"
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{ps.psName}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>{ps.psCode}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#2563eb' }}>{formatNumber(ps.totalCases)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>{formatNumber(ps.totalOffenders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#16a34a' }}>{formatNumber(ps.totalArrests)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#dc2626' }}>{formatNumber(ps.totalAbsconders)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: '#d97706' }}>{formatNumber(ps.totalContrabandKg)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-garuda-200)' }}>₹{formatNumber(ps.totalCashSeized)}</td>
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
