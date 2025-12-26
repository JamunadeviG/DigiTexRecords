export type UserRole = 'staff' | 'public';

export type DocCategory = 'Sale Deed' | 'Patta' | 'Chitta' | 'Adangal' | 'FMB' | 'Other';

export interface User {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    officeDetails?: {
        officeName: string;
        officeCode: string;
        district: string;
        taluk: string;
    };
    createdAt: string;
}

export interface LandDocument {
    id: string;
    docNumber: string;
    category: DocCategory;
    ownerName: string;
    previousOwnerName?: string;
    surveyNumber: string;
    location: string;
    date: string;
    scannedUrl?: string; // Blob URL or placeholder
    storageLocation?: {
        shelf: string;
        rack: string;
    };
    isVerified: boolean;
    timestamp: string;
    uploadedBy?: string; // User ID
    ocrConfidence?: number;
    originalFileUrl?: string; // Blob URL to actual file
    preprocessedFileUrl?: string; // Blob URL to enhanced image
    ocrData?: {
        text?: string;
        confidence?: number;
        fields?: Record<string, any> & {
            pattaNumber?: string;
            batchNumber?: string;
            summary?: string;
        };
    };
    integrityCheck?: {
        hasOriginal: boolean;
        hasOcr: boolean;
        isValid: boolean;
    };
    // Categorization
    categoryConfidence?: number;
    categoryKeywords?: string[];
}

export interface OwnershipChainNode {
    id: string;
    ownerName: string;
    date: string;
    type: string;
    isBreak?: boolean;
    children: OwnershipChainNode[];
}
