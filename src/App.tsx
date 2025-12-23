import React from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StaffDashboard } from './pages/StaffDashboard';
import { PublicSearch } from './pages/PublicSearch';
import { SignIn } from './pages/auth/SignIn';
import { PublicSignup } from './pages/auth/PublicSignup';
import { StaffSignup } from './pages/auth/StaffSignup';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import { ArrowRight, Shield, Database, Users, LogIn } from 'lucide-react';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-tn-green">Checking permissions...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Strict Role Enforcement
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.warn(`[Auth] Access Denied for ${user.role} at ${location.pathname}`);

    // Redirect to appropriate dashboard
    if (user.role === 'staff') {
      return <Navigate to="/staff" replace />;
    } else {
      return <Navigate to="/search" replace />;
    }
  }

  return <>{children}</>;
};

// Public Only Route (Redirects if already logged in)
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'staff' ? "/staff" : "/search"} replace />;
  }

  return <>{children}</>;
};

const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  // Auto-redirect if already logged in
  if (isAuthenticated && user) {
    return <Navigate to={user.role === 'staff' ? "/staff" : "/search"} replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 bg-tn-orange/10 rounded-full flex items-center justify-center mb-8">
        <Database className="w-12 h-12 text-tn-orange" />
      </div>
      <h1 className="text-5xl font-bold text-gray-900 mb-6 max-w-4xl leading-tight">
        {t('hero.title')}
      </h1>
      <p className="text-xl text-gray-600 mb-12 max-w-2xl">
        {t('hero.subtitle')}
      </p>

      <div className="flex gap-6">
        <Link to="/signin" className="flex items-center gap-2 px-8 py-4 bg-tn-orange hover:bg-orange-600 text-white rounded-lg font-semibold text-lg transition-transform hover:-translate-y-1 shadow-lg shadow-orange-200">
          <LogIn size={20} />
          Sign In to Portal
          <ArrowRight size={20} />
        </Link>
        <Link to="/signup" className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 rounded-lg font-semibold text-lg transition-transform hover:-translate-y-1">
          <Users size={20} />
          Register
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4 mx-auto text-tn-green">
            <Shield size={24} />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Secure Records</h3>
          <p className="text-gray-500 text-sm">Immutable storage for all land records ensuring zero tampering.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center mb-4 mx-auto text-tn-orange">
            <Database size={24} />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Digital Archives</h3>
          <p className="text-gray-500 text-sm">Complete digitalization of legacy documents spanning decades.</p>
        </div>
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4 mx-auto text-tn-blue">
            <Users size={24} />
          </div>
          <h3 className="font-bold text-gray-800 mb-2">Public Access</h3>
          <p className="text-gray-500 text-sm">Transparent access for citizens to verify ownership chains instantly.</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/signin" element={
          <PublicOnlyRoute>
            <SignIn />
          </PublicOnlyRoute>
        } />

        <Route path="/signup" element={
          <PublicOnlyRoute>
            <PublicSignup />
          </PublicOnlyRoute>
        } />

        {/* Protected Staff Routes */}
        <Route path="/staff" element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <StaffDashboard />
          </ProtectedRoute>
        } />

        <Route path="/staff/register" element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <StaffSignup />
          </ProtectedRoute>
        } />

        {/* Protected Public Routes */}
        <Route path="/search" element={
          <ProtectedRoute allowedRoles={['public']}>
            <PublicSearch />
          </ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
}

export default App;
