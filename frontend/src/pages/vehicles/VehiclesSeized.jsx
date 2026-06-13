/**
 * GARUDA — Vehicles Seized List Page
 * Route: /vehicles-seized
 *
 * Full-featured list of all seized vehicles with search, filter, sort, and clickable rows.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { IconCar, IconSearch } from '../../components/Icons';
import VehicleStatusModal from '../../components/VehicleStatusModal';

const VEHICLE_TYPES = [
  { value: 'ALL', label: 'All Types' },
  { value: 'TWO_WHEELER', label: 'Two Wheeler' },
  { value: 'FOUR_WHEELER', label: 'Four Wheeler' },
  { value: 'AUTO', label: 'Auto Rickshaw' },
  { value: 'TRUCK', label: 'Truck / Lorry' },
  { value: 'BUS', label: 'Bus' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'SEIZED', label: 'Seized' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'COURT_CUSTODY', label: 'Court Custody' },
  { value: 'DISPOSED', label: 'Disposed' },
];

const STATUS_COLORS = {
  SEIZED: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  RELEASED: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  COURT_CUSTODY: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  DISPOSED: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.25)' },
};

const TYPE_LABELS = {
  TWO_WHEELER: 'Two Wheeler',
  FOUR_WHEELER: 'Four Wheeler',
  AUTO: 'Auto',
  TRUCK: 'Truck',
  BUS: 'Bus',
  OTHER: 'Other',
};

const inp = "w-full px-3 py-2 rounded-lg text-sm outline-none";
const fieldStyle = { background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' };

export default function VehiclesSeized() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [search, setSearch] = useState('');
  const [vehicleType, setVehicleType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  
  // Modal state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchVehicles();
  }, [page, vehicleType, status]);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const params = { page, size, vehicleType, status };
      if (search) params.search = search;
      const res = await api.get('/vehicles', { params });
      setVehicles(res.data.data?.content || []);
      setTotal(res.data.data?.totalElements || 0);
      setError('');
    } catch (err) {
      setError('Failed to load seized vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault?.();
    setSearch(searchInput);
    setPage(0);
    // Trigger fetch after state update
    setTimeout(() => fetchVehicles(), 0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const totalPages = Math.ceil(total / size);

  const getStatusStyle = (s) => STATUS_COLORS[s] || STATUS_COLORS.SEIZED;
  const getTypeLabel = (t) => TYPE_LABELS[t] || t;

  const fmt = (val) => {
    if (!val) return '—';
    return val;
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <IconCar size={24} color="#ec4899" />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
              Vehicles Seized
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            All vehicles seized in NDPS cases — {total} record{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card rounded-xl p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          {/* Search Input */}
          <div className="flex-1 relative min-w-[200px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <IconSearch size={16} color="var(--color-garuda-500)" />
            </div>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by registration no, owner, make/model, FIR no..."
              className={inp}
              style={{ ...fieldStyle, paddingLeft: '2.25rem' }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={vehicleType}
            onChange={(e) => { setVehicleType(e.target.value); setPage(0); }}
            className={inp}
            style={{ ...fieldStyle, width: 'auto', minWidth: '140px', cursor: 'pointer' }}
          >
            {VEHICLE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(0); }}
            className={inp}
            style={{ ...fieldStyle, width: 'auto', minWidth: '140px', cursor: 'pointer' }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            className="px-5 py-2 rounded-lg text-sm text-white font-medium transition-colors"
            style={{ background: 'var(--color-accent-500)', cursor: 'pointer', border: 'none' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-accent-600)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--color-accent-500)'; }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="flex items-center justify-center gap-2 text-sm animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Loading vehicles...
            </div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <IconCar size={40} color="var(--color-garuda-600)" />
            <p className="mt-3 text-sm font-medium" style={{ color: 'var(--color-garuda-400)' }}>
              No seized vehicles found
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-500)' }}>
              Vehicles added during case registration will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header whitespace-nowrap">
                    <th className="text-left">Registration No</th>
                    <th className="text-left">Type</th>
                    <th className="text-left">Make / Model</th>
                    <th className="text-left">Owner</th>
                    <th className="text-left">FIR No</th>
                    <th className="text-left">Police Station</th>
                    <th className="text-center">Status</th>
                    <th className="text-left">Seizure Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const statusStyle = getStatusStyle(v.currentStatus);
                    return (
                      <tr
                        key={v.id}
                        className="table-row cursor-pointer transition-colors whitespace-nowrap"
                        onClick={() => navigate(`/cases/${v.caseId}`)}
                        style={{ cursor: 'pointer' }}
                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-garuda-700)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = ''; }}
                      >
                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: 'var(--color-garuda-50)' }}>
                          {v.registrationNo}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                          {getTypeLabel(v.vehicleType)}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                          {fmt(v.makeModel)}
                          {v.color && <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>({v.color})</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                          {fmt(v.ownerName)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium" style={{ color: 'var(--color-info-400)' }}>
                            {v.firNo || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                          {fmt(v.psName)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                            style={{
                              background: statusStyle.bg,
                              color: statusStyle.text,
                              border: `1px solid ${statusStyle.border}`,
                            }}
                          >
                            {v.currentStatus?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-400)' }}>
                          {fmtDate(v.seizureDate)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicle(v);
                              setIsModalOpen(true);
                            }}
                            className="text-xs px-3 py-1.5 rounded bg-transparent transition-colors"
                            style={{ border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-200)' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--color-garuda-700)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            Update
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden flex flex-col gap-4 p-4" style={{ background: 'var(--color-garuda-900)' }}>
              {vehicles.map((v) => {
                const statusStyle = getStatusStyle(v.currentStatus);
                return (
                  <div 
                    key={v.id} 
                    className="rounded-xl p-4 cursor-pointer"
                    style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
                    onClick={() => navigate(`/cases/${v.caseId}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono font-bold text-base" style={{ color: 'var(--color-garuda-50)' }}>
                          {v.registrationNo}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                          {fmt(v.psName)} • {fmtDate(v.seizureDate)}
                        </p>
                      </div>
                      <span
                        className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}
                      >
                        {v.currentStatus?.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="rounded p-2 mb-3 mt-3 text-sm flex justify-between items-center" style={{ background: 'var(--color-garuda-900)' }}>
                      <span style={{ color: 'var(--color-garuda-400)' }}>Type: <span style={{ color: 'var(--color-garuda-100)' }}>{getTypeLabel(v.vehicleType)}</span></span>
                      <span style={{ color: 'var(--color-garuda-400)' }}>FIR: <span style={{ color: 'var(--color-info-400)' }}>{v.firNo || '—'}</span></span>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="text-xs space-y-1">
                        <p style={{ color: 'var(--color-garuda-300)' }}>
                          <span style={{ color: 'var(--color-garuda-500)' }}>Model: </span>
                          {fmt(v.makeModel)} {v.color ? `(${v.color})` : ''}
                        </p>
                        <p style={{ color: 'var(--color-garuda-300)' }}>
                          <span style={{ color: 'var(--color-garuda-500)' }}>Owner: </span>
                          {fmt(v.ownerName)}
                        </p>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVehicle(v);
                          setIsModalOpen(true);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded transition-colors"
                        style={{ color: 'var(--color-accent-400)', background: 'var(--color-garuda-700)' }}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--color-garuda-700)' }}>
                <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                  Page {page + 1} of {totalPages} ({total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: page === 0 ? 'var(--color-garuda-800)' : 'var(--color-garuda-700)',
                      color: page === 0 ? 'var(--color-garuda-600)' : 'var(--color-garuda-200)',
                      cursor: page === 0 ? 'not-allowed' : 'pointer',
                      border: 'none',
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      background: page >= totalPages - 1 ? 'var(--color-garuda-800)' : 'var(--color-garuda-700)',
                      color: page >= totalPages - 1 ? 'var(--color-garuda-600)' : 'var(--color-garuda-200)',
                      cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                      border: 'none',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <VehicleStatusModal
        vehicle={selectedVehicle}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVehicle(null);
        }}
        onSuccess={fetchVehicles}
      />
    </div>
  );
}
