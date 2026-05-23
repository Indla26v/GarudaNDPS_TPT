/**
 * GARUDA — Case Detail View (Page 3) — Phase 1
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';
import CaseLifecyclePanel from '../../components/CaseLifecyclePanel';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading case details...</div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--color-danger-400)' }}>{error || 'Case not found'}</p>
        <Link to="/cases" className="text-sm mt-4 inline-block" style={{ color: 'var(--color-accent-400)' }}>← Back to Cases</Link>
      </div>
    );
  }

  const currentStageIdx = STAGES.indexOf(caseData.stage);
  const canEdit = perms.hasPermission?.('CASE_CREATE') || perms.hasMinRole?.('SI');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/cases" className="text-xs mb-2 inline-block" style={{ color: 'var(--color-garuda-400)' }}>← Back to Cases</Link>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Case: {caseData.firNo}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            {caseData.psName} • {caseData.caseDate ? new Date(caseData.caseDate).toLocaleDateString('en-IN') : '—'}
          </p>
        </div>
        {canEdit && (
          <Link
            to={`/cases/${id}/edit`}
            className="px-4 py-2 rounded-lg text-sm font-medium"
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
          <div className="rounded-xl p-6" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-garuda-300)' }}>Case Progress</h3>
            <div className="flex items-center gap-0">
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl p-6 space-y-3" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Case Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>FIR Number</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>{caseData.firNo}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Section of Law</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>{caseData.sectionOfLaw || '—'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Station</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>{caseData.psName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Contraband</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {caseData.contrabandType ? CONTRABAND_LABELS[caseData.contrabandType] || caseData.contrabandType : '—'}
                    {caseData.quantity ? ` (${caseData.quantity} ${caseData.quantityUnit || ''})` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Source → Destination</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>
                    {[caseData.sourceLocation, caseData.destinationLocation].filter(Boolean).join(' → ') || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Date</p>
                  <p style={{ color: 'var(--color-garuda-100)' }}>{caseData.caseDate ? new Date(caseData.caseDate).toLocaleDateString('en-IN') : '—'}</p>
                </div>
              </div>
              {caseData.intelligenceNotes && (
                <p className="text-sm pt-2" style={{ color: 'var(--color-garuda-300)' }}>
                  <span className="text-xs" style={{ color: 'var(--color-garuda-500)' }}>Intelligence: </span>
                  {caseData.intelligenceNotes}
                </p>
              )}
            </div>

            <div className="rounded-xl p-6 space-y-3" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <h3 className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>
                Accused ({caseData.accused?.length || 0})
              </h3>
              {caseData.accused?.length > 0 ? (
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
                        to={`/offenders/${ca.offenderId}/edit`}
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

          {caseData.seizures?.length > 0 && (
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
        </>
      )}

      {tab === 'lifecycle' && (
        <CaseLifecyclePanel caseId={id} canEdit={canEdit} />
      )}
    </div>
  );
}
