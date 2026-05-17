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
import CaseManagement from './pages/cases/CaseManagement';
import CaseForm from './pages/cases/CaseForm';
import CaseDetail from './pages/cases/CaseDetail';
import FieldStaff from './pages/field/FieldStaff';
import Surveillance from './pages/surveillance/Surveillance';
import FinancialAnalysis from './pages/finance/FinancialAnalysis';
import NetworkMap from './pages/network/NetworkMap';
import Reports from './pages/reports/Reports';
import DeletionRequests from './pages/workflows/DeletionRequests';
import EditRequests from './pages/workflows/EditRequests';
import UserManagement from './pages/admin/UserManagement';
import TeamManagement from './pages/admin/TeamManagement';
import AuditLogs from './pages/admin/AuditLogs';
import DistrictAnalytics from './pages/DistrictAnalytics';
import { usePermissions } from './hooks/usePermissions';
import './index.css';

function IndexRedirect() {
  const perms = usePermissions();
  if (perms.isAdmin) {
    return <Navigate to="/admin/users" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function DashboardRoute() {
  const perms = usePermissions();
  if (perms.isAdmin) {
    return <Navigate to="/admin/users" replace />;
  }
  return <Dashboard />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<DashboardRoute />} />

            {/* Offenders — viewable by all, edit/create guarded in backend */}
            <Route path="offenders" element={<OffenderList />} />
            <Route path="offenders/new" element={<OffenderForm />} />
            <Route path="offenders/:id/edit" element={<OffenderForm />} />

            {/* Case Management (Page 3) */}
            <Route path="cases" element={<CaseManagement />} />
            <Route path="cases/new" element={<CaseForm />} />
            <Route path="cases/:id" element={<CaseDetail />} />
            <Route path="cases/:id/edit" element={<CaseForm />} />

            {/* Field Staff Module (Page 4) */}
            <Route path="mobile" element={<FieldStaff />} />

            {/* Technical Surveillance (Page 5) — Cyber Crime: TECH_CELL, ANALYST, STF */}
            <Route path="surveillance" element={
              <RoleGuard permission="TECH_VIEW_ALL">
                <Surveillance />
              </RoleGuard>
            } />

            {/* Financial Analysis (Page 6) — Cyber Crime: FIN_CELL, STF */}
            <Route path="finance" element={
              <RoleGuard permission="FIN_VIEW_ALL">
                <FinancialAnalysis />
              </RoleGuard>
            } />

            {/* Network & Chain Analysis (Page 7) — Cyber Crime: ANALYST, TECH_CELL, STF */}
            <Route path="network" element={
              <RoleGuard permission="NET_VIEW_ALL">
                <NetworkMap />
              </RoleGuard>
            } />

            {/* Reports & Intelligence (Page 8) */}
            <Route path="reports" element={<Reports />} />

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

            {/* Admin Routes (Page 9) */}
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
            <Route path="admin/teams" element={
              <RoleGuard permission="TEAM_MANAGEMENT">
                <TeamManagement />
              </RoleGuard>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
