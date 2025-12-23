import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const SignIn: React.FC = () => {
    const { login, isLoading, error } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/'); // Redirect to Dashboard logic will handle actual path
        } catch (err) {
            // Error managed by context
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="w-16 h-16 bg-tn-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-tn-orange" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Unified Login</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Access the Tamil Nadu Land Registry
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-tn-orange focus:border-tn-orange focus:z-10 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-tn-orange focus:border-tn-orange focus:z-10 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input id="remember-me" type="checkbox" className="h-4 w-4 text-tn-orange focus:ring-tn-orange border-gray-300 rounded" />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">Remember me</label>
                        </div>
                        <div className="text-sm">
                            <a href="#" className="font-medium text-tn-orange hover:text-orange-600">Forgot password?</a>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-tn-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tn-orange disabled:opacity-70"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
                    </button>

                    <div className="text-center text-sm">
                        <span className="text-gray-500">Don't have an account? </span>
                        <Link to="/signup" className="font-medium text-tn-green hover:text-green-700">
                            Sign Up
                        </Link>
                    </div>

                    <div className="mt-4 text-center">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                            Unified Portal Login for Staff & Citizens
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
};
