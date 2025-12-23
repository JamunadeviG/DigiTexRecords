import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Search, MapPin, FileText, ChevronRight, ShieldCheck, AlertTriangle, Filter, Calendar, User, FileDigit } from 'lucide-react';
import { motion } from 'framer-motion';

interface SearchResult {
    _id: string;
    ownerName: string;
    docNumber: string;
    registrationDate: string;
    surveyNumber: string;
    documentType: string;
    village: string;
    fullText?: string;
    extractedText?: string;
    fileName: string;
}

export const PublicSearch: React.FC = () => {
    const { t } = useLanguage();

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        survey: '',
        owner: '',
        year: '',
        place: '',
        docType: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // Data State
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Chain View State
    const [selectedDoc, setSelectedDoc] = useState<SearchResult | null>(null);
    const [chain, setChain] = useState<SearchResult[]>([]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setHasSearched(true);
        setSelectedDoc(null);
        setChain([]);

        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('q', searchTerm);
            if (filters.survey) params.append('survey', filters.survey);
            if (filters.owner) params.append('owner', filters.owner);
            if (filters.year) params.append('year', filters.year);
            if (filters.place) params.append('place', filters.place);
            if (filters.docType) params.append('docType', filters.docType);

            const response = await fetch(`http://localhost:5000/api/public/search?${params.toString()}`);
            const data = await response.json();

            if (data.results) {
                // Map backend structure to frontend interface if needed
                // Currently backend returns simple objects
                setResults(data.results);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectDoc = async (doc: SearchResult) => {
        setSelectedDoc(doc);

        // Fetch Chain: Find all docs with SAME Survey Number
        // We can re-use the search API for this
        try {
            const params = new URLSearchParams();
            params.append('survey', doc.surveyNumber); // Filter purely by survey for chain

            const response = await fetch(`http://localhost:5000/api/public/search?${params.toString()}`);
            const data = await response.json();

            if (data.results) {
                // Sort by date (Oldest first for timeline)
                // Note: registrationDate is string, might need robust parsing. 
                // Creating a simple sorter assuming format or Year priority.
                const sorted = data.results.sort((a: SearchResult, b: SearchResult) => {
                    return (a.registrationDate || '').localeCompare(b.registrationDate || '');
                });
                setChain(sorted);
            }
        } catch (error) {
            console.error("Chain fetch failed");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold text-gray-800 mb-3">{t('nav.public')} Portal</h1>
                <p className="text-gray-500 max-w-2xl mx-auto">
                    Search land records, verify ownership chains, and download digitally signed copies.
                </p>
            </div>

            {/* Search Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-10">
                <form onSubmit={handleSearch}>
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-tn-green focus:ring-4 focus:ring-green-50 outline-none text-lg"
                                placeholder="Search by details, text content, or document ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-5 py-3 rounded-xl border font-medium flex items-center gap-2 transition-colors ${showFilters ? 'bg-orange-50 border-orange-200 text-tn-orange' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Filter size={18} /> Filters
                        </button>
                        <button
                            type="submit"
                            className="bg-tn-green hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-md shadow-green-200"
                        >
                            Search Records
                        </button>
                    </div>

                    {/* Advanced Filters */}
                    {showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100"
                        >
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><FileDigit size={12} /> Survey No.</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 123/4B"
                                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-tn-orange outline-none"
                                    value={filters.survey}
                                    onChange={e => setFilters({ ...filters, survey: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><User size={12} /> Owner Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Ramanathan"
                                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-tn-orange outline-none"
                                    value={filters.owner}
                                    onChange={e => setFilters({ ...filters, owner: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Calendar size={12} /> Year</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 2024"
                                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-tn-orange outline-none"
                                    value={filters.year}
                                    onChange={e => setFilters({ ...filters, year: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><MapPin size={12} /> Village/Taluk</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Madurai"
                                    className="w-full p-2 rounded-lg border border-gray-200 text-sm focus:border-tn-orange outline-none"
                                    value={filters.place}
                                    onChange={e => setFilters({ ...filters, place: e.target.value })}
                                />
                            </div>
                        </motion.div>
                    )}
                </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Results List */}
                <div className={`${selectedDoc ? 'lg:col-span-4' : 'lg:col-span-12'} transition-all`}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-gray-700 flex items-center gap-2">
                            <Search size={18} /> Search Results
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{results.length}</span>
                        </h2>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-20">
                            <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-tn-green rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-400">Searching archives...</p>
                        </div>
                    ) : results.length === 0 && hasSearched ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500">No documents found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className={`grid ${selectedDoc ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
                            {results.map(doc => (
                                <div
                                    key={doc._id}
                                    onClick={() => handleSelectDoc(doc)}
                                    className={`bg-white p-5 rounded-xl border cursor-pointer transition-all hover:shadow-md group ${selectedDoc?._id === doc._id ? 'border-tn-green ring-1 ring-tn-green bg-green-50/10' : 'border-gray-100 hover:border-orange-200'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase tracking-wide">
                                            {doc.documentType || 'Document'}
                                        </div>
                                        <span className="text-xs text-gray-400 font-mono">{doc.docNumber || 'N/A'}</span>
                                    </div>

                                    <h3 className="font-bold text-gray-800 mb-1 group-hover:text-tn-orange transition-colors">
                                        {doc.ownerName || 'Unknown Owner'}
                                    </h3>

                                    <div className="space-y-1 text-sm text-gray-500 mb-4">
                                        <div className="flex items-center gap-2">
                                            <FileDigit size={14} className="text-gray-300" />
                                            <span>Survey: <span className="font-medium text-gray-700">{doc.surveyNumber || 'N/A'}</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-gray-300" />
                                            <span>{doc.registrationDate || 'Unknown Date'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={14} className="text-gray-300" />
                                            <span>{doc.village || 'Unknown Place'}</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-gray-50 flex justify-between items-center text-xs">
                                        <span className="text-green-600 flex items-center gap-1 font-medium">
                                            <ShieldCheck size={12} /> Verified
                                        </span>
                                        <span className="text-tn-blue group-hover:underline">View Chain &rarr;</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ownership Chain Visualization */}
                {selectedDoc && (
                    <div className="lg:col-span-8">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden sticky top-8"
                        >
                            <div className="bg-gray-50 p-6 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-tn-orange">
                                            <FileText size={16} />
                                        </div>
                                        Ownership Chain: {selectedDoc.surveyNumber}
                                    </h3>
                                    <p className="text-sm text-gray-500 pl-10">Tracing history for Survey No. {selectedDoc.surveyNumber}</p>
                                </div>
                                <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-red-500 text-sm">Close</button>
                            </div>

                            <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                <div className="relative pl-8 border-l-2 border-dashed border-gray-200 space-y-10">
                                    {chain.map((node, idx) => (
                                        <div key={node._id} className="relative">
                                            {/* Timeline Node */}
                                            <div className={`absolute -left-[43px] top-6 w-6 h-6 rounded-full border-4 border-white shadow-md flex items-center justify-center ${node._id === selectedDoc._id ? 'bg-tn-orange scale-125' : 'bg-gray-400'}`}>
                                                {node._id === selectedDoc._id && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>

                                            <div className={`rounded-xl p-6 border transition-all ${node._id === selectedDoc._id ? 'bg-orange-50/50 border-orange-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                                <div className="flex flex-wrap justify-between gap-4 mb-4">
                                                    <div>
                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                                                            {node.documentType || 'Document'} • {node.registrationDate?.split('-')[0] || 'Year N/A'}
                                                        </span>
                                                        <h4 className="text-lg font-bold text-gray-900">{node.ownerName}</h4>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-medium text-gray-900">{node.docNumber}</div>
                                                        <div className="text-xs text-gray-500">{node.registrationDate}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 bg-white/50 p-3 rounded-lg border border-gray-100 ">
                                                    <div>
                                                        <span className="text-gray-400 text-xs block">Document Type</span>
                                                        {node.documentType || 'Sale Deed'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 text-xs block">Village/Taluk</span>
                                                        {node.village || 'N/A'}
                                                    </div>
                                                </div>

                                                {/* Gap Detection Logic (Simple) */}
                                                {idx < chain.length - 1 && (
                                                    // Check if gap > 10 years (very crude check)
                                                    // Assuming date is sortable or Year is extractable
                                                    <div className="hidden">Gap Check</div>
                                                )}

                                                <div className="mt-4 flex gap-3">
                                                    <button className="flex-1 py-2 text-xs font-bold text-tn-blue bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                                                        Preview Document
                                                    </button>
                                                    <button className="flex-1 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors">
                                                        Download Certified Copy
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {chain.length === 0 && (
                                    <div className="text-center text-gray-500 italic">No additional history found. This might be the primary record.</div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #E5E7EB;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
};
