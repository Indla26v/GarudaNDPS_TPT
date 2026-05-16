import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OffenderList from './pages/offenders/OffenderList';
import OffenderForm from './pages/offenders/OffenderForm';
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
            <Route path="offenders" element={<OffenderList />} />
            <Route path="offenders/new" element={<OffenderForm />} />
            <Route path="offenders/:id/edit" element={<OffenderForm />} />
            
            {/* Cases Placeholder - for Phase 2/3 */}
            <Route path="cases" element={
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="text-4xl mb-4">📁</div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>Cases Module</h2>
                  <p className="text-sm mt-2" style={{ color: 'var(--color-garuda-400)' }}>Coming in Phase 2</p>
                </div>
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
