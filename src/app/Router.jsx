import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/core/auth/AuthContext';
import { ToastProvider } from '@/core/context/ToastContext';
import { FeedbackProvider } from '@/core/context/FeedbackContext';
import { ThemeProvider } from '@/core/context/ThemeContext';
import { ToastContainer } from '@/core/components/Toast';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { ROLE_HOME, ROLES } from '@/core/utils/constants';
import { Layout } from '@/app/Layout';

import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';
import SampleRedirect from '@/pages/SampleRedirect';

import AdminDashboard from '@/admin/dashboard/Dashboard';
import AdminTeam from '@/admin/team/Team';
import AdminHalls from '@/admin/halls/Halls';
import AdminSamples from '@/modules/mcs/pages/admin/Samples';
import AdminMovements from '@/modules/mcs/pages/admin/Movements';
import AdminValidityRequests from '@/admin/validity-requests/ValidityRequests';
import AdminShiftRequests from '@/admin/shift-requests/ShiftRequests';
import AdminNotifications from '@/admin/notifications/Notifications';
import AdminExport from '@/admin/reports/Export';
import AdminFeedback from '@/admin/feedback/Feedback';
import AdminSettings from '@/admin/settings/Settings';

import HallDashboard from '@/modules/mcs/pages/hall/Dashboard';
import HallSamples from '@/modules/mcs/pages/hall/Samples';
import HallAddSample from '@/modules/mcs/pages/hall/AddSample';
import HallMovements from '@/modules/mcs/pages/hall/Movements';

import MerchantDashboard from '@/modules/mcs/pages/merchant/Dashboard';
import MerchantSamples from '@/modules/mcs/pages/merchant/Samples';
import MerchantHistory from '@/modules/mcs/pages/merchant/History';
import MerchantRecalls from '@/modules/mcs/pages/merchant/Recalls';
import MerchantExport from '@/modules/mcs/pages/merchant/Export';

// Module 2 (MCP) — panels. Routed under mcp/* alongside each role's MCS
// routes per CLAUDE.md's module-boundary note.
import AdminMcpDashboard from '@/modules/mcp/pages/admin/Dashboard';
import AdminPanels from '@/modules/mcp/pages/admin/Panels';
import AdminPanelMovements from '@/modules/mcp/pages/admin/Movements';
import HallMcpDashboard from '@/modules/mcp/pages/hall/Dashboard';
import HallPanels from '@/modules/mcp/pages/hall/Panels';
import HallAddPanel from '@/modules/mcp/pages/hall/AddPanel';
import HallPanelMovements from '@/modules/mcp/pages/hall/Movements';
import MerchantMcpDashboard from '@/modules/mcp/pages/merchant/Dashboard';
import MerchantPanels from '@/modules/mcp/pages/merchant/Panels';

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

      {/* Email "View Sample" deep link — any authenticated role lands
          here, gets bounced to their own role-scoped samples list with
          the drawer pre-opened for that BT code. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/sample/:btCode" element={<SampleRedirect />} />
      </Route>

      {/* Admin — Module 1 (MCS). Module 2 (MCP) would add its own
          sibling <Route path="mcp/*"> block under the same
          ProtectedRoute + AdminLayout without touching this tree. */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
        <Route path="/admin" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="team" element={<AdminTeam />} />
          <Route path="halls" element={<AdminHalls />} />
          <Route path="samples" element={<AdminSamples />} />
          <Route path="movements" element={<AdminMovements />} />
          <Route path="validity-requests" element={<AdminValidityRequests />} />
          <Route path="shift-requests" element={<AdminShiftRequests />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="export" element={<AdminExport />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="mcp/dashboard" element={<AdminMcpDashboard />} />
          <Route path="mcp/panels" element={<AdminPanels />} />
          <Route path="mcp/movements" element={<AdminPanelMovements />} />
        </Route>
      </Route>

      {/* Manager (hall_manager role) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.HALL_MANAGER]} />}>
        <Route path="/hall" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HallDashboard />} />
          <Route path="samples" element={<HallSamples />} />
          <Route path="add-sample" element={<HallAddSample />} />
          <Route path="movements" element={<HallMovements />} />
          <Route path="mcp/dashboard" element={<HallMcpDashboard />} />
          <Route path="mcp/panels" element={<HallPanels />} />
          <Route path="mcp/add-panel" element={<HallAddPanel />} />
          <Route path="mcp/movements" element={<HallPanelMovements />} />
        </Route>
      </Route>

      {/* Merchant */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.MERCHANT]} />}>
        <Route path="/merchant" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MerchantDashboard />} />
          <Route path="samples" element={<MerchantSamples />} />
          <Route path="history" element={<MerchantHistory />} />
          <Route path="recalls" element={<MerchantRecalls />} />
          <Route path="export" element={<MerchantExport />} />
          <Route path="mcp/dashboard" element={<MerchantMcpDashboard />} />
          <Route path="mcp/panels" element={<MerchantPanels />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeedbackProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <ToastContainer />
          </ToastProvider>
        </FeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
