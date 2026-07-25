import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/shared/context/AuthContext';
import { ToastProvider } from '@/shared/context/ToastContext';
import { ToastContainer } from '@/shared/components/Toast';
import { ProtectedRoute } from '@/shared/routes/ProtectedRoute';
import { ROLE_HOME, ROLES } from '@/shared/utils/constants';

import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

import AdminLayout from '@/modules/mcs/admin/AdminLayout';
import AdminDashboard from '@/modules/mcs/admin/pages/Dashboard';
import AdminBuyers from '@/modules/mcs/admin/pages/Buyers';
import AdminHalls from '@/modules/mcs/admin/pages/Halls';
import AdminUsers from '@/modules/mcs/admin/pages/Users';
import AdminSamples from '@/modules/mcs/admin/pages/Samples';
import AdminMovements from '@/modules/mcs/admin/pages/Movements';

import HallLayout from '@/modules/mcs/hall/HallLayout';
import HallDashboard from '@/modules/mcs/hall/pages/Dashboard';
import HallSamples from '@/modules/mcs/hall/pages/Samples';
import HallAddSample from '@/modules/mcs/hall/pages/AddSample';
import HallMovements from '@/modules/mcs/hall/pages/Movements';

import MerchantLayout from '@/modules/mcs/merchant/MerchantLayout';
import MerchantDashboard from '@/modules/mcs/merchant/pages/Dashboard';
import MerchantSamples from '@/modules/mcs/merchant/pages/Samples';
import MerchantHistory from '@/modules/mcs/merchant/pages/History';
import MerchantRecalls from '@/modules/mcs/merchant/pages/Recalls';
import MerchantExport from '@/modules/mcs/merchant/pages/Export';

function RootRedirect() {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />

      {/* Admin — Module 1 (MCS). Module 2 (MCP) would add its own
          sibling <Route path="mcp/*"> block under the same
          ProtectedRoute + AdminLayout without touching this tree. */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="buyers" element={<AdminBuyers />} />
          <Route path="halls" element={<AdminHalls />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="samples" element={<AdminSamples />} />
          <Route path="movements" element={<AdminMovements />} />
        </Route>
      </Route>

      {/* Manager (hall_manager role) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.HALL_MANAGER]} />}>
        <Route path="/hall" element={<HallLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HallDashboard />} />
          <Route path="samples" element={<HallSamples />} />
          <Route path="add-sample" element={<HallAddSample />} />
          <Route path="movements" element={<HallMovements />} />
        </Route>
      </Route>

      {/* Merchant */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.MERCHANT]} />}>
        <Route path="/merchant" element={<MerchantLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MerchantDashboard />} />
          <Route path="samples" element={<MerchantSamples />} />
          <Route path="history" element={<MerchantHistory />} />
          <Route path="recalls" element={<MerchantRecalls />} />
          <Route path="export" element={<MerchantExport />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <ToastContainer />
      </ToastProvider>
    </AuthProvider>
  );
}
