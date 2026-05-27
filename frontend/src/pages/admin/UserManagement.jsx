/**
 * GARUDA — User Management Page (Admin Only)
 * 
 * Full CRUD for user accounts with role assignment and PS assignment.
 */
import { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';

const ROLES = ['ADMIN', 'SP', 'ASP', 'DSP', 'CI', 'SI', 'CONSTABLE'];

const ROLE_LABELS = {
  ADMIN: 'Admin', SP: 'SP', ASP: 'ASP', DSP: 'DSP', CI: 'CI (SHO)', SI: 'SI', CONSTABLE: 'Constable',
};

const DEPARTMENTS = [
  'ADMINISTRATION', 'OPERATIONS', 'INTELLIGENCE', 'FIN_CELL', 'TECH_CELL', 'ANALYST', 'LEGAL', 'STF',
];

const DEPT_LABELS = {
  ADMINISTRATION: 'Administration', OPERATIONS: 'Operations', INTELLIGENCE: 'Intelligence',
  FIN_CELL: 'Financial Cell', TECH_CELL: 'Tech Cell', ANALYST: 'Analyst', LEGAL: 'Legal', STF: 'Special Task Force',
};

const ROLE_COLORS = {
  ADMIN:     { bg: '#ef4444', text: '#fff' },
  SP:        { bg: '#8b5cf6', text: '#fff' },
  ASP:       { bg: '#6366f1', text: '#fff' },
  DSP:       { bg: '#3b82f6', text: '#fff' },
  CI:        { bg: '#22c55e', text: '#fff' },
  SI:        { bg: '#f59e0b', text: '#000' },
  CONSTABLE: { bg: '#6b7280', text: '#fff' },
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  // Form States
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '', department: 'OPERATIONS', badgeNumber: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, psRes] = await Promise.all([
        api.get('/admin/users?size=500'), // Ensure we fetch enough or all
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
          department: form.department,
          badgeNumber: form.badgeNumber || null,
          policeStationId: form.policeStationId || null,
          ...(form.password && { password: form.password }),
        });
      } else {
        await api.post('/admin/users', form);
      }
      setShowForm(false);
      setEditUser(null);
      setForm({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '', department: 'OPERATIONS', badgeNumber: '' });
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
      department: user.department || 'OPERATIONS',
      badgeNumber: user.badgeNumber || '',
      policeStationId: user.policeStationId || '',
    });
    setShowForm(true);
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  // Derived filter options
  const uniqueStates = useMemo(() => {
    return [...new Set(stations.map(s => s.state).filter(Boolean))].sort();
  }, [stations]);

  const availableDistricts = useMemo(() => {
    if (!selectedState) return [];
    return [...new Set(stations.filter(s => s.state === selectedState).map(s => s.district).filter(Boolean))].sort();
  }, [stations, selectedState]);

  // Reset district if state changes
  useEffect(() => {
    setSelectedDistrict('');
  }, [selectedState]);

  const clearFilters = () => {
    setSelectedState('');
    setSelectedDistrict('');
  };

  // Grouped data structure
  const districtStationsRaw = useMemo(() => {
    if (!selectedState || !selectedDistrict) return [];
    return stations.filter(s => s.state === selectedState && s.district === selectedDistrict);
  }, [selectedState, selectedDistrict, stations]);

  const stationsWithUsers = useMemo(() => {
    const psList = districtStationsRaw.map(station => ({
      ...station,
      users: users.filter(u => u.policeStationId === station.id),
    }));
    
    // Add a virtual station for users without a police station
    const unassignedUsers = users.filter(u => !u.policeStationId);
    if (unassignedUsers.length > 0) {
      psList.unshift({
        id: 'hq',
        name: 'Headquarters / Specialized Units',
        psCode: 'HQ',
        users: unassignedUsers,
      });
    }
    return psList;
  }, [districtStationsRaw, users]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg animate-pulse" style={{ color: 'var(--color-garuda-400)' }}>Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>User Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
            Manage officers grouped by their assigned locations
          </p>
        </div>
        <button
          onClick={() => { setEditUser(null); setForm({ username: '', password: '', fullName: '', role: 'CONSTABLE', policeStationId: '', department: 'OPERATIONS', badgeNumber: '' }); setShowForm(true); }}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
          style={{ background: 'var(--color-accent-500)', color: '#fff' }}
        >
          + Add Officer
        </button>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={() => { setShowForm(false); setEditUser(null); }}></div>
          <div
            className="rounded-xl p-6 relative w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-garuda-100)' }}>
              {editUser ? 'Edit Officer' : 'Add New Officer'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editUser}
                  required={!editUser}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>
                  Password {editUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d] || d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Badge Number</label>
                <input
                  type="text"
                  value={form.badgeNumber}
                  onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Police Station</label>
                <select
                  value={form.policeStationId}
                  onChange={(e) => setForm({ ...form, policeStationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
                  style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
                >
                  <option value="">— None (District Level) —</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.name} ({s.psCode})</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditUser(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--color-accent-500)', color: '#fff' }}
                >
                  {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
            {formError && (
              <p className="text-sm mt-3" style={{ color: '#f87171' }}>{formError}</p>
            )}
          </div>
        </div>
      )}

      {/* Cascading Filters */}
      <div 
        className="p-4 rounded-xl flex flex-col md:flex-row gap-4 items-end"
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="flex-1 w-full">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Select State</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm cursor-pointer"
            style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
          >
            <option value="">— Select a State —</option>
            {uniqueStates.map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>

        <div className="flex-1 w-full">
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-garuda-300)' }}>Select District</label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50 cursor-pointer"
            style={{ background: '#ffffff', color: 'var(--color-garuda-50)', border: '1px solid var(--color-garuda-700)' }}
          >
            <option value="">— Select a District —</option>
            {availableDistricts.map(district => <option key={district} value={district}>{district}</option>)}
          </select>
        </div>

        <div>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer h-[38px]"
            style={{ background: 'var(--color-garuda-600)', color: 'var(--color-garuda-200)', border: '1px solid var(--color-garuda-700)' }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedState || !selectedDistrict ? (
        // Empty State (No selection)
        <div 
          className="flex flex-col items-center justify-center p-12 rounded-xl text-center"
          style={{ background: 'var(--color-garuda-800)', border: '1px dashed var(--color-garuda-700)' }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--color-garuda-600)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.43 4.07 15.95 4.07 12C4.07 11.83 4.08 11.66 4.09 11.5H11V19.93ZM13 19.93V11.5H19.91C19.92 11.66 19.93 11.83 19.93 12C19.93 15.95 16.95 19.43 13 19.93ZM19.74 9.5H13V4.26C16.39 5.05 19.04 7.54 19.74 9.5ZM11 4.26V9.5H4.26C4.96 7.54 7.61 5.05 11 4.26Z" fill="var(--color-garuda-400)"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--color-garuda-200)' }}>Please select a State and District to view officers</h3>
          <p className="text-sm mt-2" style={{ color: 'var(--color-garuda-400)' }}>Use the filters above to navigate through locations.</p>
        </div>
      ) : stationsWithUsers.length === 0 ? (
        // Empty State (No stations/officers found)
        <div 
          className="flex flex-col items-center justify-center p-12 rounded-xl text-center"
          style={{ background: 'var(--color-garuda-800)', border: '1px dashed var(--color-garuda-600)' }}
        >
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--color-garuda-200)' }}>No police stations found for this district</h3>
        </div>
      ) : (
        // Grid of Police Stations
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {stationsWithUsers.map(station => (
            <div 
              key={station.id} 
              className="rounded-xl overflow-hidden flex flex-col h-full"
              style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
            >
              {/* Card Header */}
              <div 
                className="px-5 py-4 flex justify-between items-center border-b"
                style={{ background: 'var(--color-garuda-600)', borderColor: 'var(--color-garuda-700)' }}
              >
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--color-garuda-50)' }}>
                    PS: {station.name} <span className="opacity-60 font-normal">({station.psCode})</span>
                  </h3>
                </div>
                <div className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}>
                  {station.users.length} Officer(s)
                </div>
              </div>

              {/* Card Body / Table */}
              <div className="flex-1 p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--color-garuda-600)' }}>
                      <th className="text-left px-5 py-2 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Officer</th>
                      <th className="text-left px-5 py-2 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Role</th>
                      <th className="text-right px-5 py-2 font-medium" style={{ color: 'var(--color-garuda-300)' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {station.users.map((u, i) => {
                      const roleColor = ROLE_COLORS[u.role] || ROLE_COLORS.CONSTABLE;
                      return (
                        <tr 
                          key={u.id}
                          style={{
                            borderBottom: '1px solid var(--color-garuda-700)',
                            background: i % 2 === 0 ? 'transparent' : 'var(--color-garuda-800)',
                          }}
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium" style={{ color: 'var(--color-garuda-100)' }}>{u.fullName}</div>
                            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>{u.username}</div>
                            {u.teamName && (
                              <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-garuda-300)' }}>
                                🏢 {u.teamName}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase"
                                style={{ background: roleColor.bg, color: roleColor.text }}
                              >
                                {u.role}
                              </span>
                              <span
                                className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded uppercase"
                                style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-300)' }}
                              >
                                {DEPT_LABELS[u.department] || u.department}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                  background: u.isActive ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                                  color: u.isActive ? '#16a34a' : '#dc2626',
                                }}
                              >
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(u)}
                                  className="text-xs hover:underline font-medium"
                                  style={{ color: '#2563eb' }}
                                >
                                  Edit
                                </button>
                                {u.isActive && (
                                  <button
                                    onClick={() => handleDeactivate(u.id)}
                                    className="text-xs hover:underline font-medium"
                                    style={{ color: '#dc2626' }}
                                  >
                                    Deactivate
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {station.users.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center" style={{ color: 'var(--color-garuda-500)' }}>
                          No officers currently assigned to this station.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}