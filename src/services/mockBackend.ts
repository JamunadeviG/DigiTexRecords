import type { User, LandDocument } from '../types';

// In-memory storage simulation
const LOCAL_STORAGE_KEYS = {
    USERS: 'land_registry_users',
    DOCUMENTS: 'land_registry_documents',
    SESSION: 'land_registry_session'
};

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockBackendService {
    private users: User[] = [];
    private documents: LandDocument[] = [];

    constructor() {
        this.loadFromStorage();
        if (this.users.length === 0) {
            this.seedData();
        }
    }

    private loadFromStorage() {
        try {
            // In a real browser environment (if persistence was allowed), we'd check localStorage
            // But per prompt "Data stored in browser state (since localStorage not available)" 
            // AND "Store user profile in header after login". 
            // However, for a robust demo, I'll use class properties as volatile memory.
            // If user provided persistent requirement, I'd use localStorage.
            // Prompt says "Store session in React state (useState) ... Store JWT token in memory (NOT localStorage)"
            // So I will stick to in-memory for session, but maybe use mock data for initial DB.
        } catch (e) {
            console.error(e);
        }
    }

    private seedData() {
        // Seed some documents
        this.documents = [
            {
                id: '1',
                docNumber: 'DOC-2023-001',
                category: 'Sale Deed',
                ownerName: 'Ramanathan S',
                previousOwnerName: 'Muthu Kumar',
                surveyNumber: '123/4A',
                location: 'Madurai North',
                date: '2023-05-15',
                isVerified: true,
                timestamp: new Date().toISOString(),
                storageLocation: { shelf: 'A1', rack: 'R1' },
                uploadedBy: 'staff-1'
            },
            // ... more mock docs
        ];
    }

    // --- Auth Endpoints ---

    async signUp(userData: Omit<User, 'id' | 'createdAt'> & { password: string }): Promise<{ user: User, token: string }> {
        await delay(800);

        const existing = this.users.find(u => u.email === userData.email);
        if (existing) throw new Error('Email already registered');

        const newUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            email: userData.email,
            fullName: userData.fullName,
            phone: userData.phone,
            role: userData.role,
            officeDetails: userData.officeDetails,
            createdAt: new Date().toISOString()
        };

        // In a real app, store hashed password. Here we just store the user.
        this.users.push(newUser);

        return {
            user: newUser,
            token: `mock-jwt-token-${newUser.id}-${Date.now()}`
        };
    }

    async signIn(email: string, password: string): Promise<{ user: User, token: string }> {
        await delay(800);

        // For demo, accept any password if user exists, or hardcode a demo user
        const user = this.users.find(u => u.email === email);

        // Backdoor for testing if no user created
        if (!user && email === 'staff@tn.gov.in' && password === 'admin123') {
            const demoStaff: User = {
                id: 'staff-demo',
                email: 'staff@tn.gov.in',
                fullName: 'Ravi Verma (Staff)',
                role: 'staff',
                phone: '9876543210',
                officeDetails: {
                    officeName: 'Madurai North SRO',
                    officeCode: 'MDU-001',
                    district: 'Madurai',
                    taluk: 'Madurai North'
                },
                createdAt: new Date().toISOString()
            };
            this.users.push(demoStaff);
            return { user: demoStaff, token: 'demo-token-staff' };
        }

        if (user) {
            // In real app, check password hash
            return {
                user,
                token: `mock-jwt-token-${user.id}`
            };
        }

        throw new Error('Invalid email or password');
    }

    // --- Document Endpoints ---

    async getDocuments(query?: string): Promise<LandDocument[]> {
        await delay(500);
        if (!query) return this.documents;

        const lowerQuery = query.toLowerCase();
        return this.documents.filter(doc =>
            doc.ownerName.toLowerCase().includes(lowerQuery) ||
            doc.docNumber.toLowerCase().includes(lowerQuery) ||
            doc.surveyNumber.includes(query)
        );
    }

    async uploadDocument(doc: LandDocument): Promise<LandDocument> {
        await delay(1000);
        this.documents.unshift(doc);
        return doc;
    }
}

export const mockBackend = new MockBackendService();
