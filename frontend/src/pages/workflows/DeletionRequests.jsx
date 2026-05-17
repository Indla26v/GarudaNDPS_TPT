/**
 * GARUDA — Deletion Requests Page
 * 
 * Displays all deletion requests with role-appropriate actions:
 * - Constable: can flag new records
 * - SI/CI: can escalate flagged items
 * - DSP: can officially request deletion
 * - SP: can approve requests
 * - Admin: can execute final deletion
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_COLORS = {
  FLAGGED:   { bg: 'rgba(234, 179, 8, 0.15)',  text: '#facc15', border: 'rgba(234, 179, 8, 0.3)' },
  ESCALATED: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
  REQUESTED: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  APPROVED:  { bg: 'rgba(34, 197, 94, 0.15)',  text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
  DELETED:   { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' },
  REJECTED:  { bg: 'rgba(239, 68, 68, 0.15)',  text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' },
};

export default function DeletionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const perms = usePermissions();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/deletion-requests');
      setRequests(res.data.data.content || []);
    } catch (err) {
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

  const getAvailableActions = (request) => {
    const actions = [];
    switch (request.status) {
      case 'FLAGGED':
        if (perms.canEscalateDeletion) actions.push({ action: 'escalate', label: 'Escalate', color: '#f97316' });
        break;
      case 'ESCALATED':
        if (perms.canRequestDeletion) actions.push({ action: 'request', label: 'Request Deletion', color: '#3b82f6' });
        break;
      case 'REQUESTED':
        if (perms.canApproveDeletion) actions.push({ action: 'approve', label: 'Approve', color: '#22c55e' });
        break;
      case 'APPROVED':
        if (perms.canExecuteDeletion) actions.push({ action: 'execute', label: 'Execute Deletion', color: '#ef4444' });
        break;
    }
    // Reject is available for DSP and above on non-terminal states
    if (!['DELETED', 'REJECTED'].includes(request.status) && perms.hasMinRole('DSP')) {
      actions.push({ action: 'reject', label: 'Reject', color: '#6b7280' });
    }
    return actions;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading deletion requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Deletion Requests</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Track the approval chain: Flag → Escalate → Request → Approve → Delete
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <p style={{ color: '#f87171' }}>{error}</p>
        </div>
      )}

      {/* Status Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <span
            key={status}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {status}
          </span>
        ))}
      </div>

      {/* Requests Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-garuda-700)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>ID</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Entity</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Flagged By</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Reason</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Date</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => {
                const statusColor = STATUS_COLORS[req.status] || STATUS_COLORS.FLAGGED;
                const actions = getAvailableActions(req);
                return (
                  <tr
                    key={req.id}
                    className="transition-colors duration-150"
                    style={{
                      borderBottom: '1px solid var(--color-garuda-700)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(26, 42, 74, 0.3)',
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>#{req.id}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-100)' }}>
                      {req.entityType} #{req.entityId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                      {req.flaggedBy?.name || '—'}
                      <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>
                        ({req.flaggedBy?.role})
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate" style={{ color: 'var(--color-garuda-300)' }}>
                      {req.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                      {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {actions.map(({ action, label, color }) => (
                          <button
                            key={action}
                            onClick={() => handleAction(req.id, action)}
                            disabled={actionLoading === req.id}
                            className="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                          >
                            {actionLoading === req.id ? '...' : label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                    No deletion requests found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
