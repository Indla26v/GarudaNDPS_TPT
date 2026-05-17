/**
 * GARUDA — User Management Page (Admin Only)
 * 
 * Full CRUD for user accounts with role assignment and PS assignment.
 */
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const ROLES = ['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE'];

const ROLE_COLORS = {
  ADMIN:     { bg: '#ef4444', text: '#fff' },
  SP:        { bg: '#8b5cf6', text: '#fff' },
  DSP:       { bg: '#3b82f6', text: '#fff' },
  CI:        { bg: '#22c55e', text: '#fff' },
  SI:        { bg: '#f59e0b', text: '#000' },
  CONSTABLE: { bg: '#6b7280', text: '#fff' },
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, psRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/police-stations'),
      ]);
      setUsers(usersRes.data.data.content || []);
      setStations(psRes.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, {
          fullName: form.fullName,
          role: form.role,
          policeStationId: form.policeStationId || null,
          ...(form.password && { password: form.password }),
        });
      } else {
        await api.post('/admin/users', form);
      }
      setShowForm(false);
      setEditUser(null);
      setForm({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '' });
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditUser(user);
    setForm({
      username: user.username,
      password: '',
      fullName: user.fullName,
      role: user.role,
      policeStationId: user.policeStationId || '',
    });
    setShowForm(true);
  };

  const handleDeactivate = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>User Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Manage officers, assign roles, and assign Police Stations
          </p>
        </div>
        <button
          id="btn-add-user"
          onClick={() => { setEditUser(null); setForm({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '' }); setShowForm(true); }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
          style={{ background: 'var(--color-accent-500)', color: '#fff' }}
        >
          + Add Officer
        </button>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>
            {editUser ? 'Edit Officer' : 'Add New Officer'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Username</label>
              <input
                id="input-username"
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editUser}
                required={!editUser}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>
                Password {editUser && '(leave blank to keep current)'}
              </label>
              <input
                id="input-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editUser}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Full Name</label>
              <input
                id="input-fullname"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Role</label>
              <select
                id="select-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Police Station</label>
              <select
                id="select-ps"
                value={form.policeStationId}
                onChange={(e) => setForm({ ...form, policeStationId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-100)', border: '1px solid var(--color-garuda-600)' }}
              >
                <option value="">— None (District Level) —</option>
                {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.psCode})</option>)}
              </select>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-accent-500)', color: '#fff' }}
              >
                {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditUser(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
              >
                Cancel
              </button>
            </div>
          </form>
          {formError && (
            <p className="text-sm mt-3" style={{ color: '#f87171' }}>{formError}</p>
          )}
        </div>
      )}

      {/* Users Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-garuda-700)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Name</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Username</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Role</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Police Station</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Last Login</th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const roleColor = ROLE_COLORS[u.role] || ROLE_COLORS.CONSTABLE;
                return (
                  <tr
                    key={u.id}
                    className="transition-colors duration-150"
                    style={{
                      borderBottom: '1px solid var(--color-garuda-700)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(26, 42, 74, 0.3)',
                    }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-garuda-100)' }}>{u.fullName}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-garuda-400)' }}>{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: roleColor.bg, color: roleColor.text }}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-garuda-300)' }}>
                      {u.policeStationName || '— District Level —'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: u.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: u.isActive ? '#4ade80' : '#f87171',
                        }}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-IN') : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(u)}
                          className="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                          style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                        >
                          Edit
                        </button>
                        {u.isActive && (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                    No users found
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
