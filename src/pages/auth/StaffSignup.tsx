import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { authService } from '../../services/authService';

export const StaffSignup: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!token) {
            setError("Authentication token missing. Please log in again.");
            return;
        }

        setIsLoading(true);

        try {
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
            }, token);

            setSuccess(true);
            setFormData({
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
            // Optional: navigate away or stay to add more
            // navigate('/staff/manage-users'); 
        } catch (err: any) {
            setError(err.message || "Failed to create staff account");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-tn-orange/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-tn-orange" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Add New Staff Member</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Create credentials for a new Registration Officer
                </p>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center gap-2">
                    <Shield size={18} />
                    Staff account created successfully!
                </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">Personal Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                name="fullName"
                                type="text"
                                required
                                value={formData.fullName}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
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
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-tn-orange focus:ring-tn-orange p-2 border"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-orange-50 p-6 rounded-lg space-y-4 border border-orange-100">
                    <h3 className="font-semibold text-tn-orange border-b border-orange-200 pb-2">Office Assignment</h3>
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

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-tn-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tn-orange disabled:opacity-70"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Create Staff Account'}
                </button>
            </form>
        </div>
    );
};
