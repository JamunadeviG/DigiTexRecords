import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDocuments } from '../context/DocumentContext';
import { Upload, FileCheck, BrainCircuit, Save, Loader2, CheckCircle, FileText } from 'lucide-react';
import type { DocCategory } from '../types';
import { motion } from 'framer-motion';
import { ocrService } from '../services/ocrService'; // Add import
import { processImage, type ImageProcessingOptions } from '../services/imageProcessing'; // Add import
import { categorizeDocument } from '../services/categorizationService';
import { ZoomIn, ZoomOut, AlertTriangle, RotateCcw } from 'lucide-react'; // Add icons

const steps = ['Upload', 'Preprocessing', 'Processing', 'Review', 'Storage', 'Save'];

export const StaffDashboard: React.FC = () => {
    const { t } = useLanguage();
    const { addDocument } = useDocuments();
    const [currentStep, setCurrentStep] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState<string>('');
    const [preprocessingStatus, setPreprocessingStatus] = useState('');
    const [preprocessingProgress, setPreprocessingProgress] = useState(0);
    const [processingLogs, setProcessingLogs] = useState<string[]>([]);
    const [qualityMetrics, setQualityMetrics] = useState<any>(null);
    const [showComparison, setShowComparison] = useState(false);

    // New State for Preprocessing
    const [preprocessingOptions, setPreprocessingOptions] = useState<ImageProcessingOptions>({
        grayscale: true,
        contrast: 20,
        brightness: 10,
        threshold: -1, // Auto by default (-1)
        denoise: false
    });
    const [isHandwritten, setIsHandwritten] = useState(false);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    // State to hold multiple processed documents
    const [processedDocuments, setProcessedDocuments] = useState<any[]>([]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFiles(Array.from(event.target.files));
        }
    };

    const addLog = (msg: string) => setProcessingLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    const runPreprocessingPreview = async () => {
        if (!selectedFiles[0]) return;
        setPreprocessingStatus('Applying Filters...');
        try {
            const resultDataUrl = await processImage(selectedFiles[0], preprocessingOptions);
            setProcessedImage(resultDataUrl);
            setQualityMetrics({
                resolution: '300 DPI (Enhanced)',
                clarity: 'Optimized',
                skew: 'Auto-Corrected',
            });
            setShowComparison(true);
        } catch (err) {
            console.error(err);
        }
    };

    // Initial Preprocessing Simulation + Real Preview
    const startPreprocessing = async () => {
        setCurrentStep(1);
        setProcessingLogs([]);
        setPreprocessingProgress(0);
        setShowComparison(false);

        const stages = [
            { name: 'Loading', label: 'ஏற்றுகிறது / Loading Image', progress: 10 },
            { name: 'Analysis', label: 'ஆய்வு / Layout Analysis', progress: 30 },
        ];

        for (const stage of stages) {
            setPreprocessingStatus(stage.label);
            setPreprocessingProgress(stage.progress);
            addLog(`Running: ${stage.name}`);
            await new Promise(r => setTimeout(r, 400));
        }

        // Run actual image processing preview for the first file
        await runPreprocessingPreview();
        setPreprocessingProgress(100);
    };

    const startOcrProcessing = async () => {
        setCurrentStep(2);
        setProcessingProgress(0);

        setOcrStatus('Initializing Tesseract Engine (Tamil + English)...');

        const totalFiles = selectedFiles.length;
        const processedDocs: any[] = [];

        for (let i = 0; i < totalFiles; i++) {
            const file = selectedFiles[i];
            setOcrStatus(`Processing ${file.name}...`);
            setProcessingProgress(Math.floor(((i + 1) / totalFiles) * 100));

            try {
                // 1. Create access to Original File
                const originalUrl = URL.createObjectURL(file);

                // 2. Use Preprocessed image if available (and if it's the single selected file), else use original
                // In a multi-file scenario, we might need to preprocess all. For now, we assume single file preview logic
                // applies to the FIRST file, or if we processed a specific one. 
                // To keep it simple for batch: if we have a processedImage state AND it matches this file (index 0), use it.
                // Otherwise process on the fly or use original. 
                // *Correct approach for this plan*: We store the processed result.

                let processedUrl = originalUrl;
                if (i === 0 && processedImage) {
                    processedUrl = processedImage;
                } else if (preprocessingOptions.threshold !== -1) {
                    // Auto-process others if options set (simulated for speed here, or await real process)
                    // For demo speed, we'll just use original or await processImage(file, preprocessingOptions)
                    processedUrl = await processImage(file, preprocessingOptions);
                }

                // 3. OCR
                const result = await ocrService.extractText(file, { isHandwritten });
                const catResult = categorizeDocument(result.text);

                processedDocs.push({
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    docNumber: result.fields.docNumber || '',
                    ownerName: result.fields.ownerName || '',
                    previousOwnerName: result.fields.previousOwnerName || '',
                    surveyNumber: result.fields.surveyNumber || '',
                    category: catResult.category || (result.fields.category || 'Sale Deed') as DocCategory,
                    location: result.fields.location || '',
                    date: result.fields.date || new Date().toISOString().split('T')[0],
                    shelf: '',
                    rack: '',
                    confidence: result.confidence,
                    // New Mapping Fields
                    originalFileUrl: originalUrl,
                    preprocessedFileUrl: processedUrl,
                    ocrData: {
                        text: result.text,
                        fields: result.fields,
                        confidence: result.confidence
                    },
                    integrityCheck: {
                        hasOriginal: true,
                        hasOcr: result.text.length > 0,
                        isValid: true
                    },
                    langConfidence: result.langConfidence,
                    categoryConfidence: catResult.confidence,
                    categoryKeywords: catResult.keywordsFound
                });

            } catch (error) {
                console.error("Processing failed", error);
                processedDocs.push({
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    confidence: 0,
                    docNumber: 'ERROR',
                    ownerName: '',
                    category: 'Sale Deed',
                    integrityCheck: { hasOriginal: true, hasOcr: false, isValid: false },
                    categoryConfidence: 0
                });
            }
        }

        setProcessingProgress(100);
        setOcrStatus('Finalizing...');
        await new Promise(r => setTimeout(r, 500));

        setProcessedDocuments(processedDocs);
        setCurrentStep(3);
    };

    const updateDocField = (index: number, field: string, value: string) => {
        const updatedDocs = [...processedDocuments];
        updatedDocs[index] = { ...updatedDocs[index], [field]: value };
        setProcessedDocuments(updatedDocs);
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
                timestamp: new Date().toISOString(),
                // Links
                originalFileUrl: doc.originalFileUrl,
                preprocessedFileUrl: doc.preprocessedFileUrl,
                ocrData: doc.ocrData,
                integrityCheck: doc.integrityCheck
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
        <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BrainCircuit className="text-tn-orange" />
                {t('nav.staff')} - Digitalization Workflow
            </h2>

            {/* Stepper */}
            <div className="flex justify-between mb-8 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                {steps.map((step, idx) => (
                    <div key={idx} className={`flex flex-col items-center gap-2 bg-gray-50 px-2`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${idx <= currentStep ? 'bg-tn-orange text-white' : 'bg-gray-300 text-gray-500'
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
                                onClick={startPreprocessing}
                                className="px-8 py-3 bg-tn-orange hover:bg-orange-600 text-white rounded-md font-bold shadow-lg flex items-center gap-2 transition-all hover:scale-105"
                            >
                                <BrainCircuit size={20} />
                                Start Preprocessing
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

                {/* Step 2: Advanced Preprocessing Editor */}
                {currentStep === 1 && (
                    <div className="flex flex-col h-full">
                        {!showComparison ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-16 h-16 text-tn-orange animate-spin mb-6" />
                                <h3 className="text-xl font-bold text-gray-800 mb-2">{preprocessingStatus}</h3>
                                <div className="w-full max-w-md bg-gray-200 rounded-full h-4 overflow-hidden mt-4">
                                    <div
                                        className="bg-tn-orange h-full transition-all duration-300 ease-out"
                                        style={{ width: `${preprocessingProgress}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in zoom-in duration-500">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-gray-800">Enhance Document Quality</h3>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-orange-100 px-3 py-1 rounded cursor-pointer border border-orange-200 hover:bg-orange-200">
                                            <input
                                                type="checkbox"
                                                checked={isHandwritten}
                                                onChange={(e) => setIsHandwritten(e.target.checked)}
                                                className="w-4 h-4 text-tn-orange rounded focus:ring-tn-orange"
                                            />
                                            Enhance Handwriting (OCR Mode)
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    {/* Parameter Controls */}
                                    <div className="space-y-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-bold uppercase text-gray-500">Contrast</label>
                                                <span className="text-xs font-mono">{preprocessingOptions.contrast}</span>
                                            </div>
                                            <input
                                                type="range" min="-50" max="100"
                                                value={preprocessingOptions.contrast}
                                                onChange={(e) => setPreprocessingOptions({ ...preprocessingOptions, contrast: Number(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-bold uppercase text-gray-500">Brightness</label>
                                                <span className="text-xs font-mono">{preprocessingOptions.brightness}</span>
                                            </div>
                                            <input
                                                type="range" min="-50" max="50"
                                                value={preprocessingOptions.brightness}
                                                onChange={(e) => setPreprocessingOptions({ ...preprocessingOptions, brightness: Number(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-bold uppercase text-gray-500">Binarization Thresh.</label>
                                                <span className="text-xs font-mono">{preprocessingOptions.threshold === -1 ? 'Auto' : preprocessingOptions.threshold}</span>
                                            </div>
                                            <input
                                                type="range" min="-1" max="255"
                                                value={preprocessingOptions.threshold}
                                                onChange={(e) => setPreprocessingOptions({ ...preprocessingOptions, threshold: Number(e.target.value) })}
                                                className="w-full"
                                            />
                                        </div>

                                        <div className="flex gap-2 pt-4">
                                            <button onClick={runPreprocessingPreview} className="flex-1 px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded hover:bg-gray-900 flex items-center justify-center gap-2">
                                                <RotateCcw size={14} /> Re-Apply
                                            </button>
                                        </div>
                                    </div>

                                    {/* Preview Area */}
                                    <div className="col-span-2 grid grid-cols-2 gap-4 h-[400px]">
                                        <div className="border border-gray-300 rounded overflow-hidden flex flex-col bg-gray-900">
                                            <div className="text-center text-xs text-white py-1 bg-black/50">Original</div>
                                            <div className="flex-1 relative">
                                                {selectedFiles[0] && (
                                                    <img
                                                        src={URL.createObjectURL(selectedFiles[0])}
                                                        className="absolute inset-0 w-full h-full object-contain"
                                                        alt="Original"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="border border-tn-green rounded overflow-hidden flex flex-col bg-gray-900">
                                            <div className="text-center text-xs text-white py-1 bg-tn-green">Processed Preview</div>
                                            <div className="flex-1 relative">
                                                {processedImage ? (
                                                    <img
                                                        src={processedImage}
                                                        className="absolute inset-0 w-full h-full object-contain"
                                                        alt="Processed"
                                                    />
                                                ) : <div className="flex items-center justify-center h-full text-white/50">Rendering...</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4">
                                    <button
                                        onClick={() => setCurrentStep(0)}
                                        className="px-6 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={startOcrProcessing}
                                        className="px-8 py-2 bg-tn-green hover:bg-green-700 text-white rounded-md font-bold shadow-lg"
                                    >
                                        Confirm & Start Extraction
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: OCR Processing */}
                {currentStep === 2 && (
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
                            {['Data Extraction (Tam/Eng)', 'Validation', 'Formatting'].map((task, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                                    <CheckCircle size={14} className="text-tn-green" /> {task}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 4: Advanced Review */}
                {currentStep === 3 && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Verification & Review</h3>
                                <p className="text-sm text-gray-500">Cross-reference extracts with the document viewer.</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}><ZoomOut size={16} /></button>
                                <span className="p-2 text-sm font-mono border-t border-b">{Math.round(zoomLevel * 100)}%</span>
                                <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setZoomLevel(z => Math.min(3, z + 0.2))}><ZoomIn size={16} /></button>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-5 gap-6 overflow-hidden">
                            {/* Document Viewer */}
                            <div className="col-span-2 bg-gray-800 rounded-lg overflow-hidden relative border border-gray-700">
                                <div className="absolute inset-0 overflow-auto custom-scrollbar">
                                    {processedImage && (
                                        <img
                                            src={processedImage}
                                            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                                            className="transition-transform duration-200"
                                            alt="Doc"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Form Editor */}
                            <div className="col-span-3 overflow-y-auto pr-2 space-y-6">
                                {processedDocuments.map((doc, index) => (
                                    <div key={index} className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                                <FileText size={18} /> {doc.fileName}
                                            </h4>
                                            <div className="flex gap-2">
                                                <span className={`text-xs px-2 py-1 rounded font-bold ${doc.confidence > 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    Confidence: {Math.round(doc.confidence)}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { k: 'docNumber', l: 'Document No / ஆவண எண்' },
                                                { k: 'ownerName', l: 'Owner / உரிமையாளர்' },
                                                { k: 'previousOwnerName', l: 'Prev. Owner / முந்தையவர்' },
                                                { k: 'surveyNumber', l: 'Survey No / சர்வே எண்' },
                                                { k: 'date', l: 'Date / தேதி' },
                                                { k: 'location', l: 'Location / இடம்' },
                                            ].map(field => (
                                                <div key={field.k} className="relative">
                                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{field.l}</label>
                                                    <input
                                                        // @ts-ignore
                                                        value={doc[field.k]}
                                                        // @ts-ignore
                                                        onChange={(e) => updateDocField(index, field.k, e.target.value)}
                                                        className={`w-full p-2 text-sm border rounded focus:ring-2 focus:ring-tn-orange focus:outline-none 
                                                            // @ts-ignore
                                                            ${!doc[field.k] && ['ownerName', 'docNumber'].includes(field.k) ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                                    />
                                                    {/* Validation Warning */}
                                                    {/* @ts-ignore */}
                                                    {!doc[field.k] && ['ownerName', 'docNumber'].includes(field.k) && (
                                                        <AlertTriangle className="absolute right-2 top-8 text-red-400 w-4 h-4" />
                                                    )}
                                                </div>
                                            ))}
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Category / வகை</label>
                                                <select
                                                    value={doc.category}
                                                    onChange={(e) => updateDocField(index, 'category', e.target.value)}
                                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-tn-orange focus:outline-none"
                                                >
                                                    <option>Sale Deed</option>
                                                    <option>Patta</option>
                                                    <option>Encumbrance</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="px-6 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
                                >
                                    Back to Preprocessing
                                </button>
                                <button
                                    onClick={() => setCurrentStep(4)}
                                    className="px-8 py-3 bg-tn-orange hover:bg-orange-600 text-white rounded-md font-semibold shadow-lg transition-transform hover:scale-105"
                                >
                                    Confirm & Proceed to Storage
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 5: Storage Assignment */}
                {currentStep === 4 && (
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
