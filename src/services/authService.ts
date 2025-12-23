import type { User } from '../types';

const API_URL = 'http://localhost:5000/api/auth';

export const authService = {
    async signUp(userData: Omit<User, 'id' | 'createdAt'> & { password: string }): Promise<{ user: User, token: string }> {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signup failed');
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
