import React, { createContext, useContext, useState } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (userData: any) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await authService.signIn(email, password);
            setUser(response.user);
            setToken(response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('token', response.token);
        } catch (err: any) {
            setError(err.message || 'Login failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData: any) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await authService.registerPublic(userData);
            setUser(response.user);
            setToken(response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('token', response.token);
        } catch (err: any) {
            setError(err.message || 'Registration failed');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            isLoading,
            error
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
