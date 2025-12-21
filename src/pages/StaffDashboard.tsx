import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { Upload, FileCheck, BrainCircuit, Save, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { DocCategory } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

const steps = ['Upload', 'Processing', 'Review', 'Storage', 'Save'];

export const StaffDashboard: React.FC = () => {
    const { t } = useLanguage();
    const { addDocument } = useDocuments();
    const [currentStep, setCurrentStep] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    // State to hold multiple processed documents
    const [processedDocuments, setProcessedDocuments] = useState<any[]>([]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFiles(Array.from(event.target.files));
        }
    };

    const startProcessing = () => {
        setIsProcessing(true);
        setCurrentStep(1);

        // Simulate OCR Processing
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            setProcessingProgress(progress);

            if (progress < 40) setOcrStatus('Scanning Documents...');
            else if (progress < 70) setOcrStatus('Extracting Text (OCR)...');
            else if (progress < 90) setOcrStatus('Categorizing Documents...');
            else setOcrStatus('Verifying Data...');

            if (progress >= 100) {
                clearInterval(interval);
                setIsProcessing(false);
                setCurrentStep(2);

                // Generate mock data for EACH selected file
                const newDocs = selectedFiles.map((file, index) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    docNumber: `DOC-${2024}-${1000 + index}`,
                    ownerName: index % 2 === 0 ? 'Ganesh Kumar' : 'Senthil Nathan',
                    previousOwnerName: 'Ramanathan S',
                    surveyNumber: `123/${4 + index}A`,
                    category: 'Sale Deed' as DocCategory,
                    location: 'Chennai South',
                    date: '2024-12-20',
                    shelf: '',
                    rack: ''
                }));
                setProcessedDocuments(newDocs);
            }
        }, 100);
    };

    const updateLocation = (index: number, field: 'shelf' | 'rack', value: string) => {
        const updatedDocs = [...processedDocuments];
        updatedDocs[index] = { ...updatedDocs[index], [field]: value };
        setProcessedDocuments(updatedDocs);
    };

    const handleSave = () => {
        // Validate
        const missingLocation = processedDocuments.some(d => !d.shelf || !d.rack);
        if (missingLocation) {
            alert("Please assign Shelf and Rack numbers for ALL documents.");
            return;
        }

        processedDocuments.forEach(doc => {
            addDocument({
                id: doc.id,
                docNumber: doc.docNumber,
                category: doc.category,
                ownerName: doc.ownerName,
                previousOwnerName: doc.previousOwnerName,
                surveyNumber: doc.surveyNumber,
                location: doc.location,
                date: doc.date,
                storageLocation: { shelf: doc.shelf, rack: doc.rack },
                isVerified: true,
                timestamp: new Date().toISOString()
            });
        });

        alert(`${processedDocuments.length} Documents Saved Successfully!`);
        setCurrentStep(0);
        setSelectedFiles([]);
        setProcessedDocuments([]);
    };

    // calculate how many docs have location assigned
    const assignedCount = processedDocuments.filter(d => d.shelf && d.rack).length;

    return (
        <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BrainCircuit className="text-tn-orange" />
                {t('nav.staff')} - Digitalization Workflow
            </h2>

            {/* Stepper */}
            <div className="flex justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                {steps.map((step, idx) => (
                    <div key={idx} className={`flex flex-col items-center gap-2 bg-gray-50 px-2`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${idx <= currentStep ? 'bg-tn-green text-white' : 'bg-gray-300 text-gray-500'
                            }`}>
                            {idx + 1}
                        </div>
                        <span className={`text-xs ${idx <= currentStep ? 'font-bold text-gray-800' : 'text-gray-400'}`}>{step}</span>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8 min-h-[400px]">

                {/* Step 1: Upload */}
                {currentStep === 0 && (
                    selectedFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-tn-orange transition-colors cursor-pointer group"
                            onClick={() => document.getElementById('file-upload')?.click()}>
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                multiple
                                onChange={handleFileSelect}
                                // @ts-ignore
                                webkitdirectory=""
                                directory=""
                            />
                            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="text-tn-orange w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('upload.title')}</h3>
                            <p className="text-gray-500 text-center max-w-sm">{t('upload.desc')}</p>
                            <p className="text-xs text-gray-400 mt-4 bg-gray-100 px-3 py-1 rounded-full">Supported: PDF, JPG, PNG</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full border-2 border-tn-green rounded-lg p-12 bg-green-50/30">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <FileCheck className="text-tn-green w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">{selectedFiles.length} Documents Selected</h3>
                            <p className="text-gray-600 mb-6 font-medium max-w-md truncate text-center">
                                {selectedFiles[0]?.name} {selectedFiles.length > 1 && `+ ${selectedFiles.length - 1} others`}
                            </p>

                            <button
                                onClick={startProcessing}
                                className="px-8 py-3 bg-tn-orange hover:bg-orange-600 text-white rounded-md font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                            >
                                <BrainCircuit size={20} />
                                Start AI Extraction
                            </button>

                            <button
                                onClick={() => setSelectedFiles([])}
                                className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
                            >
                                Cancel & Re-upload
                            </button>
                        </div>
                    )
                )}

                {/* Step 2: Processing */}
                {currentStep === 1 && (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="w-16 h-16 text-tn-green animate-spin mb-6" />
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">{ocrStatus}</h3>
                        <div className="w-full max-w-md bg-gray-200 rounded-full h-4 overflow-hidden mt-4">
                            <div
                                className="bg-tn-green h-full transition-all duration-300 ease-out"
                                style={{ width: `${processingProgress}%` }}
                            />
                        </div>
                        <p className="text-gray-500 mt-2 text-sm">{processingProgress}% Complete</p>

                        <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-lg">
                            {['Auto-Rotation', 'Denial Removal', 'Text Enhancement'].map((task, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <CheckCircle size={14} className="text-tn-green" /> {task}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3: Review (Just a summary for batch) */}
                {currentStep === 2 && (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="text-tn-green w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">OCR Processing Complete</h3>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            Successfully extracted data from {processedDocuments.length} documents.
                            Please proceed to assign physical storage locations.
                        </p>

                        <button
                            onClick={() => setCurrentStep(3)}
                            className="px-8 py-3 bg-tn-orange hover:bg-orange-600 text-white rounded-md font-semibold shadow-lg transition-transform hover:scale-105"
                        >
                            Proceed to Storage Assignment
                        </button>
                    </div>
                )}

                {/* Step 4: Storage Assignment */}
                {currentStep === 3 && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Assign Physical Storage Locations</h3>
                            <div className="bg-blue-50 px-4 py-2 rounded-full text-blue-800 text-sm font-semibold">
                                {assignedCount}/{processedDocuments.length} Assigned
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {processedDocuments.map((doc, index) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={index}
                                    className={`p-4 rounded-lg border-2 transition-colors ${doc.shelf && doc.rack ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}
                                >
                                    <div className="flex flex-col md:flex-row gap-4 items-center">
                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 shrink-0">
                                            <FileText size={24} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-gray-800 truncate">{doc.fileName}</span>
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{doc.category}</span>
                                            </div>
                                            <div className="flex gap-4 text-xs text-gray-500">
                                                <span>Doc No: {doc.docNumber}</span>
                                                <span>Owner: {doc.ownerName}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <div className="w-32">
                                                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Shelf No</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. A-12"
                                                    value={doc.shelf}
                                                    onChange={(e) => updateLocation(index, 'shelf', e.target.value)}
                                                    className={`w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 ${!doc.shelf ? 'border-red-200 focus:ring-red-200' : 'border-gray-300 focus:ring-tn-green'}`}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Rack No</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. R-05"
                                                    value={doc.rack}
                                                    onChange={(e) => updateLocation(index, 'rack', e.target.value)}
                                                    className={`w-full p-2 text-sm border rounded focus:outline-none focus:ring-2 ${!doc.rack ? 'border-red-200 focus:ring-red-200' : 'border-gray-300 focus:ring-tn-green'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={assignedCount < processedDocuments.length}
                                className={`px-8 py-3 rounded-md font-bold shadow-md flex items-center gap-2 transition-all ${assignedCount < processedDocuments.length
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-tn-orange hover:bg-orange-600 text-white hover:scale-105'
                                    }`}
                            >
                                <Save size={18} />
                                Complete & Save All
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
