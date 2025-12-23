import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

import type { UserRole } from '../../types';

export const PublicSignup: React.FC = () => {
    const { register, isLoading, error, isAuthenticated, user } = useAuth();
    const navigate = useNavigate();

    // Step 1: Basic Info, Step 2: Role Specific
    const [userType, setUserType] = useState<UserRole>('public');

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        officeName: '',
        officeCode: '',
        district: '',
        taluk: ''
    });

    // Force redirect if already logged in (Component Level Guard)
    React.useEffect(() => {
        if (isAuthenticated && user) {
            navigate(user.role === 'staff' ? '/staff' : '/search', { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        try {
            if (userType === 'staff') {
                // Direct call to authService for staff registration (since context might not expose it directly or we want to use the updated service)
                // Actually, let's use a modified register function in context or just import service here?
                // Context's register currently calls registerPublic. 
                // We should probably update the Context or just call service directly here for this specific logic.

                // Let's import authService to be safe
                const { authService } = await import('../../services/authService');
                await authService.registerStaff({
                    fullName: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    officeDetails: {
                        officeName: formData.officeName,
                        officeCode: formData.officeCode,
                        district: formData.district,
                        taluk: formData.taluk
                    }
                });
                // Login or redirect after staff signup? usually redirect to login
                navigate('/signin');
            } else {
                await register({
                    fullName: formData.fullName,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    role: 'public' // Strictly public
                });
                navigate('/search'); // Redirect to public search
            }
        } catch (err) {
            // handled by context for public, but for staff we might need to handle it or context handles error state globally?
            // The context `register` handles errors. Direct service call might throw.
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="w-16 h-16 bg-tn-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="w-8 h-8 text-tn-green" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">Create Account</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Register for Tamil Nadu Land Registry Services
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <div className="flex justify-center gap-4 mb-6">
                    <button
                        type="button"
                        onClick={() => setUserType('public')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${userType === 'public' ? 'bg-tn-green text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Public User
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserType('staff')}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${userType === 'staff' ? 'bg-tn-orange text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Register Office Staff
                    </button>
                </div>

                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                name="fullName"
                                type="text"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-green focus:ring-tn-green p-2 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email Address</label>
                            <input
                                name="email"
                                type="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-green focus:ring-tn-green p-2 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                            <input
                                name="phone"
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-green focus:ring-tn-green p-2 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-green focus:ring-tn-green p-2 border"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-green focus:ring-tn-green p-2 border"
                            />
                        </div>
                    </div>

                    {userType === 'staff' && (
                        <div className="bg-orange-50 p-4 rounded-md border border-orange-100 space-y-4 mt-6">
                            <h4 className="text-sm font-bold text-tn-orange uppercase tracking-wider">Office Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Office Name (SRO)</label>
                                    <input
                                        name="officeName"
                                        type="text"
                                        required
                                        value={formData.officeName}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
                                        placeholder="e.g. Madurai North"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Office Code</label>
                                    <input
                                        name="officeCode"
                                        type="text"
                                        required
                                        value={formData.officeCode}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">District</label>
                                    <input
                                        name="district"
                                        type="text"
                                        required
                                        value={formData.district}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Taluk</label>
                                    <input
                                        name="taluk"
                                        type="text"
                                        required
                                        value={formData.taluk}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70 mt-6 ${userType === 'staff' ? 'bg-tn-orange hover:bg-orange-600 focus:ring-tn-orange' : 'bg-tn-green hover:bg-green-700 focus:ring-tn-green'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
                    </button>

                    <div className="text-center text-sm mt-4">
                        <span className="text-gray-500">Already have an account? </span>
                        <Link to="/signin" className="font-medium text-tn-orange hover:text-orange-600">
                            Sign In
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};
