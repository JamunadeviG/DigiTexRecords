import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

import type { UserRole } from '../../types';

export const SignUp: React.FC = () => {
    const { register, isLoading, error } = useAuth();
    const navigate = useNavigate();
    // const { t } = useLanguage(); // Unused for now

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            // In a real app, set error state
            alert("Passwords do not match");
            return;
        }

        try {
            await register({
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                role: userType,
                officeDetails: userType === 'staff' ? {
                    officeName: formData.officeName,
                    officeCode: formData.officeCode,
                    district: formData.district,
                    taluk: formData.taluk
                } : undefined
            });
            navigate('/');
        } catch (err) {
            // handled by context
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
