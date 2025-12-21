import React from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StaffDashboard } from './pages/StaffDashboard';
import { PublicSearch } from './pages/PublicSearch';
import { SignIn } from './pages/auth/SignIn';
import { SignUp } from './pages/auth/SignUp';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import { ArrowRight, Shield, Database, Users, LogIn } from 'lucide-react';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <div className="p-8 text-center text-red-600">Access Denied: You do not have permission to view this page.</div>;
  }

  return <>{children}</>;
};

const LandingPage: React.FC = () => {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();

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
        {!isAuthenticated ? (
          <>
            <Link to="/signin" className="flex items-center gap-2 px-8 py-4 bg-tn-orange hover:bg-orange-600 text-white rounded-lg font-semibold text-lg transition-transform hover:-translate-y-1 shadow-lg shadow-orange-200">
              <LogIn size={20} />
              Sign In to Portal
              <ArrowRight size={20} />
            </Link>
            <Link to="/signup" className="flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 rounded-lg font-semibold text-lg transition-transform hover:-translate-y-1">
              <Users size={20} />
              Register
            </Link>
          </>
        ) : (
          <Link to={user?.role === 'staff' ? "/staff" : "/search"} className="flex items-center gap-2 px-8 py-4 bg-tn-green hover:bg-green-700 text-white rounded-lg font-semibold text-lg transition-transform hover:-translate-y-1 shadow-lg shadow-green-200">
            <ArrowRight size={20} />
            Go to Dashboard
          </Link>
        )}
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
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/staff" element={
          <ProtectedRoute allowedRoles={['staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        } />
        {/* Search is open to Public and Staff, but requires login per new requirement flow */}
        <Route path="/search" element={
          <ProtectedRoute allowedRoles={['staff', 'public']}>
            <PublicSearch />
          </ProtectedRoute>
        } />
      </Routes>
    </Layout>
  );
}

export default App;
