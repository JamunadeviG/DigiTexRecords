import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Search, UserCircle, Globe, LogOut, LogIn } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { t, language, setLanguage } = useLanguage();
    const { user, isAuthenticated, logout } = useAuth();
    const location = useLocation();

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {/* Header */}
            <header className="bg-white shadow-md border-b-4 border-tn-orange sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-tn-green rounded-full flex items-center justify-center text-white font-bold text-xl">
                            TN
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800 leading-tight">{t('app.title')}</h1>
                            <p className="text-xs text-gray-500">Government of Tamil Nadu</p>
                        </div>
                    </Link>

                    <div className="flex items-center gap-4">
                        <nav className="hidden md:flex gap-2">
                            {isAuthenticated && user?.role === 'staff' && (
                                <Link
                                    to="/staff"
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${location.pathname === '/staff'
                                        ? 'bg-tn-orange/10 text-tn-orange'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <UserCircle size={18} />
                                    {t('nav.staff')}
                                </Link>
                            )}
                            {isAuthenticated && (
                                <Link
                                    to="/search"
                                    className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${location.pathname === '/search'
                                        ? 'bg-tn-green/10 text-tn-green'
                                        : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    <Search size={18} />
                                    {t('nav.public')}
                                </Link>
                            )}
                        </nav>

                        <button
                            onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
                            className="flex items-center gap-1 px-3 py-1 border rounded-full hover:bg-gray-50 text-sm font-medium"
                        >
                            <Globe size={16} />
                            {language === 'en' ? 'தமிழ்' : 'English'}
                        </button>

                        <div className="h-6 w-px bg-gray-300 mx-2"></div>

                        {isAuthenticated ? (
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-gray-800">{user?.fullName}</p>
                                    <p className="text-xs text-gray-500 capitalize">{user?.role} User</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    title="Logout"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        ) : (
                            <Link to="/signin" className="flex items-center gap-2 px-4 py-2 bg-tn-orange text-white rounded-md text-sm font-bold hover:bg-orange-600 shadow-sm transition-colors">
                                <LogIn size={16} />
                                {t('btn.login')}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-gray-800 text-white py-6 mt-12 border-t-4 border-tn-green">
                <div className="container mx-auto px-4 text-center">
                    <p className="opacity-80">© 2024 Department of Registration, Government of Tamil Nadu.</p>
                </div>
            </footer>
        </div>
    );
};
