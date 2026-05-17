/**
 * GARUDA — Audit Logs Page (Admin Only)
 * 
 * Full audit trail viewer with filtering by action, entity type, and user.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const ACTION_COLORS = {
  CREATE:             '#22c55e',
  UPDATE:             '#3b82f6',
  DELETE:             '#ef4444',
  LOGIN:              '#8b5cf6',
  LOGOUT:             '#6b7280',
  DELETION_FLAGGED:   '#facc15',
  DELETION_ESCALATED: '#f97316',
  DELETION_REQUESTED: '#60a5fa',
  DELETION_APPROVED:  '#4ade80',
  DELETION_EXECUTED:  '#ef4444',
  DELETION_REJECTED:  '#f87171',
  EDIT_REQUESTED:     '#facc15',
  EDIT_APPROVED:      '#4ade80',
  EDIT_REJECTED:      '#f87171',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '' });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), size: '30' });
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);

      const res = await api.get(`/admin/audit-logs?${params.toString()}`);
      setLogs(res.data.data.content || []);
      setTotalPages(res.data.data.totalPages || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Audit Logs</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Complete system audit trail — every action is logged
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          id="filter-action"
          value={filters.action}
          onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(0); }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-garuda-800)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
        >
          <option value="">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          id="filter-entity"
          value={filters.entityType}
          onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(0); }}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-garuda-800)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
        >
          <option value="">All Entities</option>
          <option value="USER">USER</option>
          <option value="OFFENDER">OFFENDER</option>
          <option value="CASE">CASE</option>
          <option value="INTELLIGENCE">INTELLIGENCE</option>
        </select>
      </div>

      {/* Logs Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        {loading ? (
          <div className="p-8 text-center">
            <span className="animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-garuda-700)' }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Action</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Entity</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>User</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Details</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={log.id}
                    className="transition-colors duration-150"
                    style={{
                      borderBottom: '1px solid var(--color-garuda-700)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(26, 42, 74, 0.3)',
                    }}
                  >
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-garuda-400)' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ color: ACTION_COLORS[log.action] || '#9ca3af' }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                      {log.entityType}
                      {log.entityId && <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>#{log.entityId}</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-200)' }}>
                      {log.user?.name || '—'}
                      {log.user?.role && (
                        <span className="text-xs ml-1" style={{ color: 'var(--color-garuda-500)' }}>({log.user.role})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-64 truncate text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                      {log.details || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-garuda-500)' }}>
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                      No audit logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
          >
            ← Prev
          </button>
          <span className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
