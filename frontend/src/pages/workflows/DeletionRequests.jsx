/**
 * GARUDA — Deletion Requests Process
 * Stage 1: Constable/SI/CI Flag
 * Stage 2: DSP reviews and formally Requests from SP
 * Stage 3: SP reviews and Approves
 * Stage 4: Admin Executes the physical deletion
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_COLORS = {
  FLAGGED:   { bg: 'rgba(249, 115, 22, 0.1)', text: '#c2410c', border: 'rgba(249, 115, 22, 0.25)' }, // Orange
  ESCALATED: { bg: 'rgba(236, 72, 153, 0.1)', text: '#be185d', border: 'rgba(236, 72, 153, 0.25)' }, // Pink
  REQUESTED: { bg: 'rgba(168, 85, 247, 0.1)', text: '#6d28d9', border: 'rgba(168, 85, 247, 0.25)' }, // Purple
  APPROVED:  { bg: 'rgba(59, 130, 246, 0.1)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.25)' }, // Blue
  DELETED:   { bg: 'rgba(239, 68, 68, 0.1)',  text: '#b91c1c', border: 'rgba(239, 68, 68, 0.25)' }, // Red
  REJECTED:  { bg: 'rgba(107, 114, 128, 0.1)', text: '#4b5563', border: 'rgba(107, 114, 128, 0.25)' }  // Gray
};

export default function DeletionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const perms = usePermissions();
  const rawRole = perms.user?.role; // Need the exact role to map buttons correctly to DSP/SP/ADMIN

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/deletion-requests');
      setRequests(res.data.data.content || res.data.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load deletion requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    setActionLoading(id);
    try {
      await api.post(`/deletion-requests/${id}/${action}`);
      await fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to determine the correct action button based on Role and Status
  const renderActionContainer = (req) => {
     if (rawRole === 'CI' || rawRole === 'SI') {
        if (req.status === 'FLAGGED') {
          return (
              <button onClick={() => handleAction(req.id, 'escalate')} disabled={actionLoading === req.id} className="px-3 py-1 rounded-md text-xs font-medium bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 transition-colors">
                Escalate to DSP
              </button>
          );
        }
     } else if (rawRole === 'DSP') {
       if (req.status === 'ESCALATED') {
          return (
              <button onClick={() => handleAction(req.id, 'request')} disabled={actionLoading === req.id} className="px-3 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors">
                Request from SP
              </button>
          );
       }
     } else if (rawRole === 'SP') {
        if (req.status === 'REQUESTED') {
            return (
                <button onClick={() => handleAction(req.id, 'approve')} disabled={actionLoading === req.id} className="px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                  Approve Delete
                </button>
            );
        }
     } else if (rawRole === 'ADMIN') {
        if (req.status === 'APPROVED') {
            return (
                <button onClick={() => handleAction(req.id, 'execute')} disabled={actionLoading === req.id} className="px-3 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                  Execute Delete
                </button>
            );
        }
     }
    return <span className="text-gray-500 text-xs italic">No actions</span>;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg" style={{ color: 'var(--color-danger-400)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Deletion Operations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Strict hierarchy: Flag (Constable/CI/SI) &rarr; Escalate (CI/SI) &rarr; Request (DSP) &rarr; Approve (SP) &rarr; Execute (Admin)
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg" style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
          <p style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden shadow-lg"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-garuda-700)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>ID</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Entity</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Initiator</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Reason</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Date</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--color-garuda-400)] animate-pulse">
                    Loading deletion requests...
                  </td>
                </tr>
              ) : (
                <>
                  {requests.map((req, i) => {
                    const statusColor = STATUS_COLORS[req.status] || STATUS_COLORS.FLAGGED;
                    return (
                      <tr
                        key={req.id}
                        className="transition-colors duration-150"
                        style={{
                          borderBottom: '1px solid var(--color-garuda-700)',
                          background: i % 2 === 0 ? 'transparent' : 'var(--color-garuda-600)',
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>#{req.id}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>
                          {req.entityType} {req.entityId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase"
                            style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                          {req.flaggedBy} 
                          {req.station && <span className="block text-xs mt-0.5 opacity-60">{req.station}</span>}
                        </td>
                        <td className="px-4 py-3 max-w-48 truncate" style={{ color: 'var(--color-garuda-300)' }} title={req.reason}>
                          {req.reason || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                          {req.requestDate ? new Date(req.requestDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                           {renderActionContainer(req)}
                        </td>
                      </tr>
                    );
                  })}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                        No pending deletion workflows found for your role queue.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}