/**
 * GARUDA — Edit Requests Page
 * 
 * CI/SI can view their submitted edit requests.
 * DSP sees all pending edit requests for their PS and can approve/reject.
 * Admin sees all edit requests.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usePermissions } from '../../hooks/usePermissions';

const STATUS_COLORS = {
  PENDING:  { bg: 'rgba(234, 179, 8, 0.1)',  text: '#b45309', border: 'rgba(234, 179, 8, 0.25)' },
  APPROVED: { bg: 'rgba(34, 197, 94, 0.1)',  text: '#15803d', border: 'rgba(34, 197, 94, 0.25)' },
  REJECTED: { bg: 'rgba(239, 68, 68, 0.1)',  text: '#b91c1c', border: 'rgba(239, 68, 68, 0.25)' },
};

export default function EditRequests() {
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
      const res = await api.get('/edit-requests');
      setRequests(res.data.data.content || []);
    } catch (err) {
      setError('Failed to load edit requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    setActionLoading(id);
    try {
      await api.post(`/edit-requests/${id}/${action}`);
      await fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading edit requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Edit Requests</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          {perms.canApproveEdit
            ? 'Review and approve/reject edit requests from CI and SI officers.'
            : 'View your submitted edit requests. Changes require DSP approval.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg" style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
          <p style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Requested By</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Reason</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Date</th>
                {perms.canApproveEdit && (
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => {
                const statusColor = STATUS_COLORS[req.status] || STATUS_COLORS.PENDING;
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
                      {req.requestedBy?.name || '—'}
                      <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>
                        ({req.requestedBy?.role})
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate" style={{ color: 'var(--color-garuda-300)' }}>
                      {req.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                      {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    {perms.canApproveEdit && (
                      <td className="px-4 py-3 text-right">
                        {req.status === 'PENDING' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleAction(req.id, 'approve')}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                              style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                            >
                              {actionLoading === req.id ? '...' : 'Approve Edit'}
                            </button>
                            <button
                              onClick={() => handleAction(req.id, 'reject')}
                              disabled={actionLoading === req.id}
                              className="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={perms.canApproveEdit ? 7 : 6} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                    No edit requests found
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
