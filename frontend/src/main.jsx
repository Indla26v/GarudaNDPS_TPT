import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OffenderList from './pages/offenders/OffenderList';
import OffenderForm from './pages/offenders/OffenderForm';
import DeletionRequests from './pages/workflows/DeletionRequests';
import EditRequests from './pages/workflows/EditRequests';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import DistrictAnalytics from './pages/DistrictAnalytics';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Offenders — viewable by all, edit/create guarded in backend */}
            <Route path="offenders" element={<OffenderList />} />
            <Route path="offenders/new" element={<OffenderForm />} />
            <Route path="offenders/:id/edit" element={<OffenderForm />} />

            {/* Cases Placeholder */}
            <Route path="cases" element={
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="text-4xl mb-4">📁</div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Cases Module</h2>
                  <p className="text-sm mt-2" style={{ color: 'var(--color-garuda-400)' }}>Coming in Phase 2</p>
                </div>
              </div>
            } />

            {/* Workflow Routes */}
            <Route path="deletion-requests" element={<DeletionRequests />} />
            <Route path="edit-requests" element={
              <RoleGuard minRole="CI">
                <EditRequests />
              </RoleGuard>
            } />

            {/* District Analytics — SP & Admin only */}
            <Route path="district-analytics" element={
              <RoleGuard permission="DISTRICT_ANALYTICS">
                <DistrictAnalytics />
              </RoleGuard>
            } />

            {/* Admin Routes */}
            <Route path="admin/users" element={
              <RoleGuard permission="USER_MANAGEMENT">
                <UserManagement />
              </RoleGuard>
            } />
            <Route path="admin/audit-logs" element={
              <RoleGuard permission="AUDIT_LOGS">
                <AuditLogs />
              </RoleGuard>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
