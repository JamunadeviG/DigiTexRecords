import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QwenOCRProps {
    onClose?: () => void;
}

export const QwenOCR: React.FC<QwenOCRProps> = ({ onClose }) => {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setResult(null);
            setError(null);
        }
    };

    const handleProcess = async () => {
        if (!file) return;

        setIsThinking(true);
        setError(null);

        const formData = new FormData();
        formData.append('document', file); // 'document' matches server.js upload.single('document')
        if (user?.id) {
            formData.append('userId', user.id);
        }

        try {
            // Using fetch instead of axios to reduce dependencies for this simple component
            const response = await fetch('http://localhost:5000/api/ocr/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                const errorMessage = errData.details
                    ? `${errData.error}: ${errData.details} ${errData.hint ? `(${errData.hint})` : ''}`
                    : errData.error || 'Failed to process document';
                throw new Error(errorMessage);
            }

            const data = await response.json();
            setResult(data.data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during AI processing.");
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-auto border border-gray-100 overflow-hidden flex flex-col md:flex-row h-[600px]">
            {/* Left Panel: Upload & Preview */}
            <div className="w-full md:w-1/2 p-6 bg-gray-50 flex flex-col border-r border-gray-100">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <BrainCircuit className="text-purple-600" />
                        Qwen AI OCR
                    </h2>
                </div>

                {!file ? (
                    <div className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 text-center hover:bg-gray-100 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="w-12 h-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 font-medium">Drag & Drop or Click to Upload</p>
                        <p className="text-xs text-gray-400 mt-2">Supports JPG, PNG (Max 5MB)</p>
                    </div>
                ) : (
                    <div className="flex-1 relative rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center group">
                        <img src={previewUrl!} alt="Preview" className="max-w-full max-h-full object-contain" />
                        <button
                            onClick={() => { setFile(null); setPreviewUrl(null); setResult(null); }}
                            className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="mt-6">
                    <button
                        onClick={handleProcess}
                        disabled={!file || isThinking}
                        className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all ${!file
                            ? 'bg-gray-300 cursor-not-allowed'
                            : isThinking
                                ? 'bg-purple-400 cursor-wait'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02]'
                            }`}
                    >
                        {isThinking ? (
                            <>
                                <Loader className="animate-spin" size={20} />
                                Analyzing Structure...
                            </>
                        ) : (
                            <>
                                <BrainCircuit size={20} />
                                Extract Data
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Right Panel: Results */}
            <div className="w-full md:w-1/2 p-6 flex flex-col bg-white overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Extraction Results</h3>

                {isThinking && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                        <div className="w-16 h-16 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                        <div>
                            <p className="text-lg font-medium text-gray-800">Processing with Qwen AI</p>
                            <p className="text-sm text-gray-500">Reading Tamil text & identifying fields...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="font-bold">Extraction Failed</p>
                            <p className="text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {result && !isThinking && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="bg-green-50 text-green-800 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <CheckCircle size={16} />
                            Analysis Complete & Saved to Database
                        </div>

                        {/* Fields Grid */}
                        <div className="grid grid-cols-1 gap-3">
                            <Field label="Document Type" value={result.documentType} />
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Reg. Number" value={result.registrationNumber} />
                                <Field label="Date" value={result.registrationDate} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Seller" value={result.sellerName} />
                                <Field label="Buyer" value={result.buyerName} />
                            </div>
                            <Field label="Consideration" value={result.considerationAmount} highlight />
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Survey No" value={result.surveyNumber} />
                                <Field label="Village" value={result.village} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Taluk" value={result.taluk} />
                                <Field label="District" value={result.district} />
                            </div>
                        </div>

                        {/* Full Text Expansion */}
                        <div className="mt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Raw Extracted Text</p>
                            <div className="bg-gray-50 p-3 rounded-lg text-xs font-mono text-gray-600 whitespace-pre-wrap h-40 overflow-y-auto border border-gray-100">
                                {result.fullText || "No full text returned."}
                            </div>
                        </div>
                    </motion.div>
                )}

                {!file && !isThinking && !result && (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                        <FileText size={48} className="mb-2 opacity-50" />
                        <p className="text-sm">Upload a document to see AI extraction</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const Field = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
    <div className={`p-3 rounded-lg border ${highlight ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-100'}`}>
        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{label}</p>
        <p className={`font-medium ${highlight ? 'text-purple-900' : 'text-gray-800'} truncate`}>
            {value || "—"}
        </p>
    </div>
);
