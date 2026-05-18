import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import SupplierList from "./pages/SupplierList";
import SupplierDetail from "./pages/SupplierDetail";
import ContractsPage from "./pages/ContractsPage";
import PerformancePage from "./pages/PerformancePage";
import RiskPage from "./pages/RiskPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import ESGPage from "./pages/ESGPage";
import CompliancePage from "./pages/CompliancePage";
import ComparisonPage from "./pages/ComparisonPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SetPasswordPage from "./pages/SetPasswordPage";
import SupplierPortalPage from "./pages/SupplierPortalPage";
import SpendPage from "./pages/SpendPage";

function AppRoutes() {
  const { session, profile, profileLoading, loading, permissions } = useAuth();

  const isSupplier = !profileLoading && profile?.role === 'supplier';

  if (loading || (session && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (isSupplier) {
    return (
      <Routes>
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="*" element={<SupplierPortalPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/suppliers" element={<SupplierList />} />
        <Route path="/suppliers/:id" element={<SupplierDetail />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route
          path="/spend"
          element={
            profile?.role === "admin" || profile?.role === "procurement_manager"
              ? <SpendPage />
              : <Navigate to="/" replace />
          }
        />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/risks" element={<RiskPage />} />
        <Route path="/activity" element={<ActivityLogPage />} />
        <Route path="/esg" element={permissions.canViewESG ? <ESGPage /> : <Navigate to="/" replace />} />
        <Route
          path="/compliance"
          element={permissions.canViewESG ? <CompliancePage /> : <Navigate to="/" replace />}
        />
        <Route path="/compare" element={<ComparisonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
