import type { User } from '../types';

const API_URL = 'http://localhost:5000/api/auth';

export const authService = {
    async registerPublic(userData: Omit<User, 'id' | 'createdAt'> & { password: string }): Promise<{ user: User, token: string }> {
        const response = await fetch(`${API_URL}/register/public`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        return response.json();
    },

    async registerStaff(userData: any, token?: string): Promise<void> {
        // Headers construction
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/register/staff`, {
            method: 'POST',
            headers,
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Staff creation failed');
        }

        return response.json();
    },

    async signIn(email: string, password: string): Promise<{ user: User, token: string }> {
        const response = await fetch(`${API_URL}/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signin failed');
        }

        return response.json();
    }
};
