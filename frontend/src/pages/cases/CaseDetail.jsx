/**
 * GARUDA — Case Detail View (Page 3) — Phase 1
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';
import CaseLifecyclePanel from '../../components/CaseLifecyclePanel';
import VehicleStatusModal from '../../components/VehicleStatusModal';

const STAGES = ['FIR', 'CHARGESHEET', 'TRIAL', 'CONVICTED', 'ACQUITTED', 'CLOSED'];
const STAGE_LABELS = {
  FIR: 'FIR Registered',
  CHARGESHEET: 'Charge Sheet',
  TRIAL: 'Under Trial',
  CONVICTED: 'Convicted',
  ACQUITTED: 'Acquitted',
  CLOSED: 'Closed',
};

const CONTRABAND_LABELS = {
  DRY_GANJA: 'Dry Ganja',
  GANJA_OIL: 'Ganja Oil',
  BROWN_SUGAR: 'Brown Sugar',
  HEROIN: 'Heroin',
  MDMA: 'MDMA',
  SYNTHETIC: 'Synthetic',
  COCAINE: 'Cocaine',
  OPIUM: 'Opium',
  OTHER: 'Other',
};

export default function CaseDetail() {
  const { id } = useParams();
  const perms = usePermissions();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  
  // Modal state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchCase();
  }, [id]);

  const fetchCase = async () => {
    try {
      const res = await api.get(`/cases/${id}`);
      setCaseData(res.data.data);
    } catch {
      setError('Failed to load case details');
    } finally {
      setLoading(false);
    }
  };

  if (error || (!caseData && !loading)) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--color-danger-400)' }}>{error || 'Case not found'}</p>
        <Link to="/cases" className="text-sm mt-4 inline-block" style={{ color: 'var(--color-accent-400)' }}>← Back to Cases</Link>
      </div>
    );
  }

  const currentStageIdx = caseData ? STAGES.indexOf(caseData.stage) : -1;
  const canEdit = caseData && (perms.hasPermission?.('CASE_CREATE') || perms.hasMinRole?.('SI'));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link to="/cases" className="text-xs mb-2 inline-block" style={{ color: 'var(--color-garuda-400)' }}>← Back to Cases</Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Case: {loading ? <span className="inline-block w-40 h-7 bg-slate-700 animate-pulse rounded align-middle"></span> : caseData?.firNo}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            {loading ? (
              <span className="inline-block w-56 h-4 bg-slate-700/80 animate-pulse rounded mt-1"></span>
            ) : (
              `${caseData?.psName || ''} • ${caseData?.caseDate ? new Date(caseData.caseDate).toLocaleDateString('en-IN') : '—'}`
            )}
          </p>
        </div>
        {canEdit && (
          <Link
            to={`/cases/${id}/edit`}
            className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
          >
            Edit Case
          </Link>
        )}
      </div>

      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--color-garuda-700)' }}>
        {['overview', 'lifecycle'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm capitalize"
            style={{
              color: tab === t ? 'var(--color-accent-400)' : 'var(--color-garuda-400)',
              borderBottom: tab === t ? '2px solid var(--color-accent-500)' : 'none',
            }}
          >
            {t === 'lifecycle' ? 'Charge Sheet & Court' : 'Overview'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="rounded-xl p-6 overflow-x-auto" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-300)' }}>Case Progress</h3>
            {loading ? (
              <div className="flex items-center gap-4 min-w-[600px] py-2">
                <div className="h-6 bg-slate-700/60 rounded flex-1 animate-pulse"></div>
              </div>
            ) : (
              <div className="flex items-center gap-0 min-w-[600px]">
                {STAGES.map((stage, i) => {
                  const isActive = i <= currentStageIdx;
                  const isCurrent = i === currentStageIdx;
                  return (
                    <div key={stage} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: isCurrent || isActive ? 'var(--color-accent-500)' : 'var(--color-garuda-700)',
                            color: isActive ? '#fff' : 'var(--color-garuda-400)',
                          }}
                        >
                          {isActive ? '✓' : i + 1}
                        </div>
                        <span className="text-[10px] mt-2 text-center" style={{ color: isActive ? 'var(--color-garuda-100)' : 'var(--color-garuda-500)' }}>
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className="h-0.5 flex-1 -mt-5" style={{ background: i < currentStageIdx ? 'var(--color-accent-500)' : 'var(--color-garuda-700)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl p-6 space-y-3" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Case Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>FIR Number</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-20 h-4 bg-slate-700/60 animate-pulse rounded"></span> : caseData?.firNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Section of Law</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-24 h-4 bg-slate-700/60 animate-pulse rounded"></span> : caseData?.sectionOfLaw || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Station</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-28 h-4 bg-slate-700/60 animate-pulse rounded"></span> : caseData?.psName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Contraband</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-32 h-4 bg-slate-700/60 animate-pulse rounded"></span> : (
                      <>
                        {caseData?.contrabandType ? CONTRABAND_LABELS[caseData.contrabandType] || caseData.contrabandType : '—'}
                        {caseData?.quantity ? ` (${caseData.quantity} ${caseData.quantityUnit || ''})` : ''}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Source → Destination</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-36 h-4 bg-slate-700/60 animate-pulse rounded"></span> : [caseData?.sourceLocation, caseData?.destinationLocation].filter(Boolean).join(' → ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Date</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {loading ? <span className="inline-block w-24 h-4 bg-slate-700/60 animate-pulse rounded"></span> : caseData?.caseDate ? new Date(caseData.caseDate).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              </div>
              {loading ? (
                <div className="h-4 bg-slate-700/50 rounded w-full animate-pulse mt-2"></div>
              ) : caseData?.intelligenceNotes && (
                <p className="text-sm pt-2" style={{ color: 'var(--color-garuda-300)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Intelligence: </span>
                  {caseData.intelligenceNotes}
                </p>
              )}
            </div>

            <div className="rounded-xl p-6 space-y-3" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>
                Accused ({loading ? '...' : caseData?.accused?.length || 0})
              </h3>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-slate-700/60 rounded animate-pulse"></div>
                  <div className="h-10 bg-slate-700/60 rounded animate-pulse"></div>
                </div>
              ) : caseData?.accused?.length > 0 ? (
                <ul className="space-y-2">
                  {caseData.accused.map((ca) => (
                    <li key={ca.id} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--color-garuda-900)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                          {ca.offenderName || `Offender #${ca.offenderId}`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                          {ca.arrestStatus}
                          {ca.arrestDate ? ` • Arrested: ${new Date(ca.arrestDate).toLocaleDateString('en-IN')}` : ''}
                        </p>
                      </div>
                      <Link
                        to={`/offenders/${ca.offenderId}`}
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
                      >
                        View
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No accused linked yet</p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl p-6 border" style={{ background: 'var(--color-garuda-800)', borderColor: 'var(--color-garuda-700)' }}>
              <div className="h-5 bg-slate-700/60 rounded w-24 mb-3 animate-pulse"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="h-10 bg-slate-700/50 rounded animate-pulse"></div>
                <div className="h-10 bg-slate-700/50 rounded animate-pulse"></div>
              </div>
            </div>
          ) : caseData?.seizures?.length > 0 && (
            <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-garuda-200)' }}>Seizures</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {caseData.seizures.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg" style={{ background: 'var(--color-garuda-900)' }}>
                    {s.contrabandKg && <p className="text-sm" style={{ color: 'var(--color-warning-400)' }}>{s.contrabandKg} Kg</p>}
                    {Number(s.cashAmount) > 0 && <p className="text-sm" style={{ color: 'var(--color-success-400)' }}>₹{Number(s.cashAmount).toLocaleString('en-IN')}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && caseData?.seizedVehicles?.length > 0 && (
            <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-garuda-200)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
                  <circle cx="6.5" cy="16.5" r="2.5" />
                  <circle cx="16.5" cy="16.5" r="2.5" />
                </svg>
                Seized Vehicles ({caseData.seizedVehicles.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Reg No</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Type</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Make / Model</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Owner</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Status</th>
                      {canEdit && <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-garuda-400)' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.seizedVehicles.map((v) => {
                      const statusColors = {
                        SEIZED: '#ef4444',
                        RELEASED: '#22c55e',
                        COURT_CUSTODY: '#f59e0b',
                        DISPOSED: '#6b7280',
                      };
                      const statusColor = statusColors[v.currentStatus] || '#ef4444';
                      return (
                        <tr key={v.id} style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
                          <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: 'var(--color-garuda-50)' }}>{v.registrationNo}</td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--color-garuda-300)' }}>
                            {({ TWO_WHEELER: 'Two Wheeler', FOUR_WHEELER: 'Four Wheeler', AUTO: 'Auto', TRUCK: 'Truck', BUS: 'Bus', OTHER: 'Other' })[v.vehicleType] || v.vehicleType}
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--color-garuda-200)' }}>
                            {v.makeModel || '—'}
                            {v.color && <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>({v.color})</span>}
                          </td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--color-garuda-200)' }}>{v.ownerName || '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{ background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}40` }}
                            >
                              {v.currentStatus?.replace('_', ' ')}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsModalOpen(true);
                                }}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-transparent hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--color-accent-400)', border: '1px solid var(--color-accent-500)40' }}
                              >
                                Update
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'lifecycle' && (
        <CaseLifecyclePanel caseId={id} canEdit={canEdit} />
      )}

      <VehicleStatusModal
        vehicle={selectedVehicle}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVehicle(null);
        }}
        onSuccess={fetchCase}
      />
    </div>
  );
}
