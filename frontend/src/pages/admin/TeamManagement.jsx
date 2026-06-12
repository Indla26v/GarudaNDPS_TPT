/**
 * GARUDA — Team Management Page (Admin Only)
 * Route: /admin/teams
 * 
 * Create teams, assign to departments, add/remove members.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const DEPT_LABELS = {
  POLICE: 'Police', CYBER_ANALYTICS: 'Cyber Analytics (STF)', EXCISE: 'Excise Officer',
};

const DEPARTMENTS = Object.keys(DEPT_LABELS);

const DEPT_COLORS = {
  POLICE: '#3b82f6', CYBER_ANALYTICS: '#8b5cf6', EXCISE: '#22c55e',
};

const ROLE_LABELS = {
  SP: 'SP', ASP: 'ASP', SDPO: 'SDPO (DSP)', SHO: 'SHO (CI/SI)', CONSTABLE: 'Constable',
};

export default function TeamManagement() {
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [form, setForm] = useState({ name: '', department: 'OPERATIONS', description: '' });
  const [formError, setFormError] = useState('');
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [showAddMember, setShowAddMember] = useState(null); // teamId

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes] = await Promise.all([
        api.get('/admin/teams'),
        api.get('/admin/users?size=200'),
      ]);
      setTeams(teamsRes.data.data || []);
      setAllUsers(usersRes.data.data?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      if (editTeam) {
        await api.put(`/admin/teams/${editTeam.id}`, form);
      } else {
        await api.post('/admin/teams', form);
      }
      setShowForm(false);
      setEditTeam(null);
      setForm({ name: '', department: 'OPERATIONS', description: '' });
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save team');
    }
  };

  const handleEdit = (team) => {
    setEditTeam(team);
    setForm({ name: team.name, department: team.department, description: team.description || '' });
    setShowForm(true);
  };

  const handleAddMember = async (teamId, userId) => {
    try {
      await api.post(`/admin/teams/${teamId}/members`, { userId });
      setShowAddMember(null);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId, userId) => {
    if (!confirm('Remove this member from the team?')) return;
    try {
      await api.delete(`/admin/teams/${teamId}/members/${userId}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Delete this team? All members will be unassigned.')) return;
    try {
      await api.delete(`/admin/teams/${teamId}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete team');
    }
  };

  // Users not in any team (available to assign)
  const getAvailableUsers = (teamId) => {
    const teamMemberIds = teams.find(t => t.id === teamId)?.members?.map(m => m.id) || [];
    return allUsers.filter(u => u.role !== 'SP' && !teamMemberIds.includes(u.id));
  };



  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Team Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Create teams, assign departments, and manage members
          </p>
        </div>
        <button
          onClick={() => { setEditTeam(null); setForm({ name: '', department: 'OPERATIONS', description: '' }); setShowForm(true); }}
          className="btn btn-primary btn-sm whitespace-nowrap"
        >
          + New Team
        </button>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>
              {editTeam ? 'Edit Team' : 'Create New Team'}
            </h2>
            {formError && <div className="text-sm mb-3 p-2 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{formError}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Team Name</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Department</label>
                <select
                  value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Description</label>
                <textarea
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => { setShowForm(false); setEditTeam(null); }}
                  className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editTeam ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-xl p-6 w-full max-w-md max-h-[70vh] overflow-y-auto" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>Add Member</h2>
            <div className="space-y-2">
              {getAvailableUsers(showAddMember).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-garuda-500)' }}>No available users to add</p>
              ) : (
                getAvailableUsers(showAddMember).map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'var(--color-garuda-900)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{u.fullName}</p>
                      <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                        {ROLE_LABELS[u.role] || u.role} · {u.username}
                      </p>
                    </div>
                    <button onClick={() => handleAddMember(showAddMember, u.id)}
                      className="btn btn-primary btn-sm">
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowAddMember(null)}
                className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading ? (
          [1, 2, 3, 4].map(idx => (
            <div key={idx} className="rounded-xl overflow-hidden animate-pulse"
              style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
              <div className="p-4 border-b flex justify-between" style={{ borderColor: 'var(--color-garuda-700)' }}>
                <div className="w-1/2 space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-700 rounded w-1/2"></div>
                </div>
                <div className="w-1/4 h-8 bg-slate-700 rounded"></div>
              </div>
              <div className="p-3 space-y-2">
                <div className="h-10 bg-slate-700/60 rounded animate-pulse"></div>
                <div className="h-10 bg-slate-700/60 rounded animate-pulse"></div>
              </div>
            </div>
          ))
        ) : teams.length === 0 ? (
          <div className="lg:col-span-2 p-12 text-center rounded-xl" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            <p className="text-lg" style={{ color: 'var(--color-garuda-400)' }}>No teams created yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-500)' }}>Click "New Team" to get started</p>
          </div>
        ) : teams.map(team => (
          <div key={team.id} className="rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
            {/* Team Header */}
            <div className="p-4 flex items-start justify-between" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold truncate" style={{ color: 'var(--color-garuda-100)' }}>{team.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: (DEPT_COLORS[team.department] || '#6b7280') + '22', color: DEPT_COLORS[team.department] || '#6b7280' }}>
                    {DEPT_LABELS[team.department] || team.department}
                  </span>
                </div>
                {team.description && (
                  <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>{team.description}</p>
                )}
                <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-500)' }}>
                  {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button onClick={() => setShowAddMember(team.id)}
                  className="btn btn-primary btn-sm" title="Add member">
                  + Member
                </button>
                <button onClick={() => handleEdit(team)}
                  className="btn btn-ghost btn-sm" title="Edit team">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={() => handleDeleteTeam(team.id)}
                  className="btn btn-ghost btn-sm" title="Delete team" style={{ color: '#ef4444' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>

            {/* Members List (expanded) */}
            {(expandedTeam === team.id || team.memberCount <= 4) && team.members?.length > 0 && (
              <div className="p-3 space-y-1.5">
                {team.members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{ background: 'var(--color-garuda-900)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>
                        {m.fullName?.[0] || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{m.fullName}</p>
                        <p className="text-[10px]" style={{ color: 'var(--color-garuda-500)' }}>
                          {ROLE_LABELS[m.role] || m.role} · {m.username} {m.badgeNumber ? `· ${m.badgeNumber}` : ''}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMember(team.id, m.id)}
                      className="text-xs px-2 py-1 rounded cursor-pointer transition-all"
                      style={{ color: '#ef4444' }} title="Remove">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collapsed indicator */}
            {expandedTeam !== team.id && team.memberCount > 4 && (
              <div className="px-4 py-2 text-xs cursor-pointer" onClick={() => setExpandedTeam(team.id)}
                style={{ color: 'var(--color-accent-400)' }}>
                Click to see all {team.memberCount} members →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
