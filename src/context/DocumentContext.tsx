import React, { createContext, useContext, useState } from 'react';
import type { LandDocument } from '../types';

interface DocumentContextType {
    documents: LandDocument[];
    addDocument: (doc: LandDocument) => void;
    searchDocuments: (query: string) => LandDocument[];
    getChainForDocument: (docId: string) => LandDocument[];
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [documents, setDocuments] = useState<LandDocument[]>([]);

    const addDocument = (doc: LandDocument) => {
        setDocuments(prev => [doc, ...prev]);
    };

    const searchDocuments = (query: string) => {
        const lowerQuery = query.toLowerCase();
        return documents.filter(doc =>
            doc.ownerName?.toLowerCase().includes(lowerQuery) ||
            doc.docNumber?.toLowerCase().includes(lowerQuery) ||
            doc.surveyNumber?.includes(query) ||
            // Fuzzy search in OCR data
            (doc.ocrData?.text && doc.ocrData.text.toLowerCase().includes(lowerQuery)) ||
            (doc.ocrData?.fields && Object.values(doc.ocrData.fields).some(val =>
                typeof val === 'string' && val.toLowerCase().includes(lowerQuery)
            ))
        );
    };

    // Simple chain builder logic: Find documents where owner == previousOwner of target
    const getChainForDocument = (docId: string) => {
        const targetDoc = documents.find(d => d.id === docId);
        if (!targetDoc) return [];

        const chain: LandDocument[] = [targetDoc];
        let currentDoc = targetDoc;

        // Traverse backwards
        while (currentDoc.previousOwnerName) {
            // Find the document where owner is the current doc's previous owner
            // And survey number matches (simplified logic for demo)
            const prevDoc = documents.find(d =>
                d.ownerName === currentDoc.previousOwnerName &&
                d.surveyNumber === currentDoc.surveyNumber &&
                new Date(d.date) < new Date(currentDoc.date)
            );

            if (prevDoc) {
                chain.push(prevDoc);
                currentDoc = prevDoc;
            } else {
                break; // Chain broken or end reached
            }
        }

        return chain.reverse(); // Return chronological order
    };

    return (
        <DocumentContext.Provider value={{ documents, addDocument, searchDocuments, getChainForDocument }}>
            {children}
        </DocumentContext.Provider>
    );
};

export const useDocuments = () => {
    const context = useContext(DocumentContext);
    if (!context) {
        throw new Error('useDocuments must be used within a DocumentProvider');
    }
    return context;
};
