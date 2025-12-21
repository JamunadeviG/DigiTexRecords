import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { Search, MapPin, FileText, User, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export const PublicSearch: React.FC = () => {
    const { t } = useLanguage();
    const { searchDocuments, getChainForDocument } = useDocuments();
    const [query, setQuery] = useState('');
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

    const results = query ? searchDocuments(query) : [];
    const selectedChain = selectedDocId ? getChainForDocument(selectedDocId) : [];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setHasSearched(true);
        setSelectedDocId(null);
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">{t('nav.public')}</h1>
                <p className="text-gray-500 max-w-2xl mx-auto">
                    Verify land ownership history, view document chains, and check the status of property documents in real-time.
                </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mb-16 relative">
                <form onSubmit={handleSearch} className="relative">
                    <input
                        type="text"
                        className="w-full pl-6 pr-14 py-4 rounded-full border-2 border-gray-200 shadow-sm focus:border-tn-green focus:ring-4 focus:ring-tn-green/10 outline-none text-lg transition-all"
                        placeholder={t('search.placeholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        type="submit"
                        className="absolute right-2 top-2 bottom-2 bg-tn-green hover:bg-green-700 text-white p-3 rounded-full transition-colors"
                    >
                        <Search size={22} />
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Results List */}
                <div className="lg:col-span-1 space-y-4">
                    {hasSearched && results.length === 0 && (
                        <div className="text-center p-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-500">No documents found matching "{query}"</p>
                        </div>
                    )}

                    {results.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => setSelectedDocId(doc.id)}
                            className={`bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-pointer transition-all hover:shadow-md ${selectedDocId === doc.id ? 'ring-2 ring-tn-orange border-transparent' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">{doc.category}</span>
                                {doc.isVerified && <ShieldCheck size={16} className="text-tn-green" />}
                            </div>
                            <h3 className="font-semibold text-gray-800">{doc.ownerName}</h3>
                            <p className="text-sm text-gray-500 mb-2">{doc.docNumber}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <MapPin size={12} /> {doc.location}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chain Visualization */}
                <div className="lg:col-span-2">
                    {selectedDocId && selectedChain.length > 0 ? (
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-tn-orange/10 flex items-center justify-center text-tn-orange">
                                    <FileText size={18} />
                                </span>
                                Ownership History Chain
                            </h3>

                            <div className="relative pl-8 border-l-2 border-gray-200 space-y-12">
                                {selectedChain.map((node, idx) => (
                                    <motion.div
                                        key={node.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="relative"
                                    >
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full border-4 border-white shadow-sm ${idx === 0 ? 'bg-tn-green' : 'bg-gray-400'}`} />

                                        <div className="bg-gray-50 rounded-lg p-5 hover:bg-orange-50 transition-colors border border-transparent hover:border-orange-100 relative group">

                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-gray-800">{node.ownerName}</h4>
                                                    <p className="text-xs text-gray-500">acquired from {node.previousOwnerName || 'Original Allocation'}</p>
                                                </div>
                                                <span className="text-sm font-medium text-gray-600 bg-white px-2 py-1 rounded shadow-sm border">
                                                    {node.date}
                                                </span>
                                            </div>

                                            <div className="flex gap-4 mt-4 text-sm text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <FileText size={14} className="text-gray-400" />
                                                    {node.docNumber}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin size={14} className="text-gray-400" />
                                                    {node.surveyNumber}
                                                </div>
                                            </div>

                                            {idx < selectedChain.length - 1 && (
                                                <div className="absolute left-1/2 -bottom-10 transform -translate-x-1/2 z-10 hidden lg:block">
                                                    <ChevronRight className="transform rotate-90 text-gray-300" />
                                                </div>
                                            )}

                                            {/* Verify Badge */}
                                            <div className="absolute top-4 right-4">
                                                {node.isVerified ? (
                                                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                                        <ShieldCheck size={12} /> Verified Chain
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                                                        <AlertTriangle size={12} /> Unverified
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t flex justify-between items-center text-sm text-gray-500">
                                <p>Chain verified by Tamil Nadu Blockchain Network</p>
                                <button className="text-tn-blue font-medium hover:underline">Download Certified Copy</button>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300 min-h-[400px]">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p>Select a document to verify ownership chain</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
