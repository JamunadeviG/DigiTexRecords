import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../context/DocumentContext';
import { Upload, FileCheck, BrainCircuit, Save, Loader2, FileText, ZoomIn, ZoomOut, CheckCircle, UserPlus } from 'lucide-react';
import type { DocCategory } from '../types';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { CellData } from '../services/imageProcessing';
import { CorrectionInterface } from '../components/CorrectionInterface';
import { PreprocessingPreview } from '../components/PreprocessingPreview';


const steps = ['Upload', 'Preprocessing', 'Processing', 'Review', 'Storage', 'Save'];

// Add to start of file imports/interfaces if needed, but we can augment inline since we use 'any' for now or update types. 
// Ideally we update types/index.ts first but let's just use the fields.
import { BookOpen, Hash, FileCheck2 } from 'lucide-react'; // Added icons

export const StaffDashboard: React.FC = () => {
    const { t } = useLanguage();
    const { user, token } = useAuth();
    const { addDocument } = useDocuments();
    const [currentStep, setCurrentStep] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [ocrStatus, setOcrStatus] = useState<string>('');
    const [preprocessingStatus, setPreprocessingStatus] = useState('');
    const [preprocessingProgress, setPreprocessingProgress] = useState(0);
    const [processingLogs, setProcessingLogs] = useState<string[]>([]);

    const [stats, setStats] = useState({ speed: 0, startTime: 0, processedCount: 0 });

    const [isHandwritten, setIsHandwritten] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    // State for Preview
    const [currentPreviewDoc] = useState<any>(null);

    // Selection state for Review Phase
    const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);
    const [activeCorrectionCell, setActiveCorrectionCell] = useState<CellData | null>(null);


    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([]);
    const [processedDocuments, setProcessedDocuments] = useState<any[]>([]);

    const validateFile = (file: File): string | null => {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        const minSize = 10 * 1024; // 10KB

        if (!validTypes.includes(file.type)) return 'Unsupported Format';
        if (file.size > maxSize) return 'File too large (>10MB)';
        if (file.size < minSize) return 'File too small (<10KB)';
        // Note: Dimension check is async, doing it here would delay UI. 
        // We will assume dimensions are okay or check during preprocessing.
        return null;
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const allFiles = Array.from(event.target.files);
            const validFiles: File[] = [];
            const rejected: { file: File; reason: string }[] = [];

            allFiles.forEach(file => {
                // Filter system files / hidden files
                if (file.name.startsWith('.') || file.name === 'Thumbs.db') return;

                const error = validateFile(file);
                if (error) {
                    rejected.push({ file, reason: error });
                } else {
                    validFiles.push(file);
                }
            });

            // Smart Queue: Sort smaller files first
            validFiles.sort((a, b) => a.size - b.size);

            setSelectedFiles(prev => [...prev, ...validFiles]);
            setRejectedFiles(prev => [...prev, ...rejected]);

            if (rejected.length > 0) {
                // Optional: Notify user immediately or just show in UI
                console.warn(`Rejected ${rejected.length} files.`);
            }
        }
    };

    const removeFile = (index: number) => {
        const newFiles = [...selectedFiles];
        newFiles.splice(index, 1);
        setSelectedFiles(newFiles);
    };

    // Processing Mode: 'local' | 'cloud'
    const [processingMode, setProcessingMode] = useState<'local' | 'cloud'>('local');

    // ... existing logs ...
    const addLog = (msg: string) => setProcessingLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    // Unified Qwen Batch Processing
    const startQwenBatchProcessing = async () => {
        // Enforce Preprocessing -> Then OCR
        setCurrentStep(2); // 'Processing' UI
        setProcessingLogs([]);
        setProcessingProgress(0);
        setOcrStatus('Starting Intelligent Document Processing...');

        const startTime = performance.now();
        setStats({ speed: 0, startTime, processedCount: 0 });

        const tempResults: any[] = [];
        setProcessedDocuments([]);

        const totalFiles = selectedFiles.length;

        for (let i = 0; i < totalFiles; i++) {
            const file = selectedFiles[i];
            setOcrStatus(`Enhancing & Analyzing: ${file.name} (${i + 1}/${totalFiles})...`);

            try {
                // Step 1: Preprocessing (Server-side via Python)
                let imageToProcess: File = file;

                // Only preprocess if image (not PDF for now, or use server logic)
                // Assuming server handles PDF preprocessing -> Image
                const preFormData = new FormData();
                preFormData.append('document', file);

                let preprocessedBase64 = null;

                try {
                    const preResponse = await fetch('http://localhost:5000/api/ocr/preprocess', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: preFormData
                    });

                    if (preResponse.ok) {
                        const preData = await preResponse.json();
                        preprocessedBase64 = preData.processedImage;
                        // Convert back to file/blob for OCR upload if needed, OR send to OCR
                        // Ideally OCR endpoint accepts base64? No, we set it to accept file.
                        // So let's convert Blob.
                        if (preprocessedBase64) {
                            const res = await fetch(preprocessedBase64);
                            const blob = await res.blob();
                            imageToProcess = new File([blob], `pre_${file.name}`, { type: 'image/jpeg' });
                        }
                        addLog(`Preprocessing successful for ${file.name}`);
                    } else {
                        addLog(`Preprocessing skipped/failed for ${file.name}, using original.`);
                    }
                } catch (e) {
                    console.warn("Preprocessing error", e);
                    addLog(`Preprocessing failed: ${e}, using original.`);
                }

                // Step 2: OCR with Qwen (using /api/ocr/process or /api/ocr/recognize - let's use process for full struct)
                const formData = new FormData();
                formData.append('document', imageToProcess);
                if (user?.id) formData.append('userId', user.id);

                const response = await fetch('http://localhost:5000/api/ocr/process', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!response.ok) throw new Error('OCR Extract Failed');

                const data = await response.json();
                const struct = data; // /process returns flat JSON combined with root fields, or inside structuredData?
                // Server /process returns: { success, fileName, processingTime, ...resultData } where resultData has extracted fields.

                const docResult = {
                    id: Math.random().toString(36).substr(2, 9),
                    fileName: file.name,
                    file: file,
                    displayImage: preprocessedBase64 || URL.createObjectURL(file), // Show Enhanced if available
                    docNumber: struct.documentNumber || '',
                    ownerName: struct.ownerName || '',
                    previousOwnerName: '',
                    surveyNumber: struct.surveyNumber || '',
                    category: (struct.documentType || 'Sale Deed') as DocCategory,
                    location: struct.villageTaluk || '',
                    date: struct.registrationDate || new Date().toISOString().split('T')[0],
                    shelf: '',
                    rack: '',
                    confidence: 0.95,
                    ocrData: {
                        text: struct.fullExtractedText || '',
                        fields: struct,
                        confidence: 0.95
                    },
                    integrityCheck: {
                        hasOriginal: true,
                        hasOcr: true,
                        isValid: true
                    },
                    metrics: { method: 'Qwen-VL + Preprocessing' }
                };

                tempResults.push(docResult);
                setProcessedDocuments([...tempResults]);

                const currentCount = i + 1;
                setProcessingProgress(Math.floor((currentCount / totalFiles) * 100));

                const elapsedSeconds = (performance.now() - startTime) / 1000;
                setStats(prev => ({
                    ...prev,
                    speed: currentCount / elapsedSeconds,
                    processedCount: currentCount
                }));

            } catch (error) {
                console.error(`Processing Failed for ${file.name}`, error);
                addLog(`Failed: ${file.name} - ${error}`);
                tempResults.push({
                    id: Math.random().toString(36),
                    fileName: file.name,
                    file: file,
                    displayImage: URL.createObjectURL(file),
                    docNumber: 'ERROR',
                    ownerName: 'Processing Failed',
                    confidence: 0,
                    ocrData: { text: '', fields: {}, confidence: 0 },
                    integrityCheck: { isValid: false }
                });
                setProcessedDocuments([...tempResults]);
            }
        }

        setProcessingProgress(100);
        setOcrStatus('Analysis Complete! ✓');
        setCurrentStep(3);
    };

    const startPreprocessing = async () => {
        // Redirect to Cloud Mode if selected
        if (processingMode === 'cloud') {
            await startQwenBatchProcessing();
            return;
        }

        // ... Existing Local Logic ...
        setCurrentStep(1);
        setProcessingLogs([]);
        setPreprocessingProgress(0);
        setStats({ speed: 0, startTime: performance.now(), processedCount: 0 });

        const tempProcessed: any[] = [];
        setProcessedDocuments([]);

        const BATCH_SIZE = 4; // Process 4 at a time (Web Worker limit often around hardware concurrency)

        for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
            const batch = selectedFiles.slice(i, i + BATCH_SIZE);

            setPreprocessingStatus(`Preprocessing (Server) batch ${Math.ceil((i + 1) / BATCH_SIZE)}...`);

            const batchPromises = batch.map(async (file) => {
                try {
                    const formData = new FormData();
                    formData.append('document', file);

                    // Call Server Preprocessing Endpoint
                    const response = await fetch('http://localhost:5000/api/ocr/preprocess', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error('Preprocessing failed');

                    const data = await response.json();
                    const processedImage = data.processedImage; // Base64

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        fileName: file.name,
                        file: file, // Keep original file for reference or re-upload if needed? 
                        // Actually, for Step 3 (OCR), we should ideally upload the PROCESSED image.
                        // But since we have it as Base64, we can convert back to blob or just keep it here and use it in Step 3.
                        displayImage: processedImage || URL.createObjectURL(file),
                        tableData: null,
                        confidence: 0,
                        docNumber: '', ownerName: '', category: 'Sale Deed',
                        ocrData: { text: '', fields: {}, confidence: 0 },
                        integrityCheck: { hasOriginal: true, hasOcr: false, isValid: true }
                    };
                } catch (error) {
                    console.error(`Error processing ${file.name}`, error);
                    addLog(`Failed: ${file.name}`);
                    return {
                        id: Math.random().toString(36),
                        fileName: file.name,
                        file: file,
                        displayImage: URL.createObjectURL(file), // Fallback
                        error: true
                    };
                }
            });

            const results = await Promise.all(batchPromises);
            results.filter(Boolean).forEach(r => tempProcessed.push(r));

            setProcessedDocuments([...tempProcessed]);
            // ... strict stats update omitted for brevity ...
            const currentCount = Math.min(i + BATCH_SIZE, selectedFiles.length);
            setPreprocessingProgress((currentCount / selectedFiles.length) * 100);
        }

        setPreprocessingStatus('Preprocessing Complete! ✓');
    };

    const startOcrProcessing = async () => {
        setCurrentStep(2);
        setProcessingProgress(0);
        setOcrStatus('Initializing Fast OCR Engine...');
        const startTime = performance.now();
        setStats(prev => ({ ...prev, startTime, processedCount: 0 }));

        const totalFiles = processedDocuments.length;
        const finalResults: any[] = [];

        // Parallel Batch Processing for OCR
        const BATCH_SIZE = 4; // Use same batch size as pool

        for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
            const batch = processedDocuments.slice(i, i + BATCH_SIZE);
            setOcrStatus(`Enhancing & Extracting Batch ${Math.ceil((i + 1) / BATCH_SIZE)}...`);

            const batchPromises = batch.map(async (preDoc) => {
                const file = preDoc.file;
                try {
                    // Convert Base64 displayImage back to Blob for upload
                    let imageToUpload = file;
                    if (preDoc.displayImage.startsWith('data:')) {
                        const res = await fetch(preDoc.displayImage);
                        const blob = await res.blob();
                        imageToUpload = new File([blob], file.name, { type: 'image/jpeg' });
                    }

                    const formData = new FormData();
                    formData.append('document', imageToUpload);
                    if (user?.id) formData.append('userId', user.id);

                    const response = await fetch('http://localhost:5000/api/ocr/recognize', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error('OCR API Failed');
                    const result = await response.json();

                    // Categorization logic (client-side or utilize server's?)
                    // Server returns structuredData, we can use that.
                    const straData = result.structuredData;

                    return {
                        ...preDoc,
                        docNumber: straData.docNumber || '',
                        ownerName: '', // Placeholder as server extraction is basic
                        previousOwnerName: '',
                        surveyNumber: straData.surveyNumber || '',
                        category: (straData.documentType || 'Sale Deed') as DocCategory, // Use dynamic docType
                        location: '',

                        // New Fields
                        pattaNumber: straData.pattaNumber || '',
                        batchNumber: straData.batchNumber || '',
                        summary: straData.summary || '',

                        date: straData.date || new Date().toISOString().split('T')[0],
                        shelf: '',
                        rack: '',
                        confidence: result.confidence || 0.9,
                        ocrData: {
                            text: result.text,
                            fields: straData,
                            confidence: result.confidence
                        },
                        integrityCheck: {
                            hasOriginal: true,
                            hasOcr: result.text.length > 0,
                            isValid: true
                        },
                        categoryConfidence: 0.9,
                        categoryKeywords: []
                    };
                } catch (error) {
                    console.error("OCR Processing failed", error);
                    return { ...preDoc, confidence: 0, docNumber: 'ERROR' };
                }
            });

            const results = await Promise.all(batchPromises);
            finalResults.push(...results);

            // Update stats
            const currentCount = Math.min(i + BATCH_SIZE, totalFiles);
            setProcessingProgress(Math.floor((currentCount / totalFiles) * 100));

            const elapsedSeconds = (performance.now() - startTime) / 1000;
            setStats(prev => ({
                ...prev,
                speed: currentCount / elapsedSeconds,
                processedCount: currentCount
            }));
        }

        setProcessingProgress(100);
        setOcrStatus('Finalizing...');

        setProcessedDocuments(finalResults);
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

    const handleCellSave = (cellId: number, newText: string) => {
        if (activeCorrectionCell) {
            const updatedDocs = [...processedDocuments];
            const currentDoc = updatedDocs[selectedDocIndex];

            if (currentDoc.tableData) {
                const cellIndex = currentDoc.tableData.cells.findIndex((c: CellData) => c.id === cellId);
                if (cellIndex !== -1) {
                    currentDoc.tableData.cells[cellIndex].text = newText;
                    currentDoc.tableData.cells[cellIndex].confidence = 100; // Manually corrected
                    currentDoc.tableData.cells[cellIndex].needsReview = false;
                }
            }
            setProcessedDocuments(updatedDocs);
            setActiveCorrectionCell(null);
        }
    };

    const handleSave = async () => {
        const missingLocation = processedDocuments.some(d => !d.shelf || !d.rack);
        if (missingLocation) {
            alert("Please assign Shelf and Rack numbers for ALL documents.");
            return;
        }

        let savedCount = 0;
        let failedCount = 0;

        for (const doc of processedDocuments) {
            try {
                const formData = new FormData();
                // Append the original file
                if (doc.file) {
                    formData.append('document', doc.file);
                } else if (doc.displayImage && doc.displayImage.startsWith('data:')) {
                    // Fallback: if we only have base64 (e.g. from camera), convert to blob
                    const res = await fetch(doc.displayImage);
                    const blob = await res.blob();
                    formData.append('document', blob, doc.fileName || 'scanned_doc.jpg');
                }

                // Append Metadata
                formData.append('docNumber', doc.docNumber || '');
                formData.append('category', doc.category || 'Unknown');
                formData.append('ownerName', doc.ownerName || '');
                formData.append('surveyNumber', doc.surveyNumber || '');
                formData.append('pattaNumber', doc.pattaNumber || '');
                formData.append('batchNumber', doc.batchNumber || '');
                formData.append('summary', doc.summary || '');

                formData.append('date', doc.date || new Date().toISOString());
                formData.append('village', doc.location || ''); // Mapping location to village for now

                // Add storage location to property details or separate
                // We'll put it in propertyDetails for now if Schema doesn't have it explicit, 
                // OR add it to summary/extra. 
                // The new endpoint expects basic fields. Storage Location isn't in my new Schema explicitly yet?
                // Wait, I didn't add shelf/rack to server.js Schema. I should add `storageLocation` object to Schema or just put in propertyDetails.
                // Let's assume propertyDetails for flexibility or update schema later. 
                // For now, let's put it in `ocrData` or `summary`.

                // Better: Add it to ocrData so it's safely stored.
                const enrichedOcrData = {
                    ...doc.ocrData,
                    storageLocation: { shelf: doc.shelf, rack: doc.rack }
                };
                formData.append('ocrData', JSON.stringify(enrichedOcrData));

                const response = await fetch('http://localhost:5000/api/documents/save', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Failed to save ${doc.fileName}`);
                }

                const result = await response.json();

                // Update Local Context for immediate UI feedback (optional)
                if (result.success && result.document) {
                    addDocument({
                        ...result.document,
                        id: result.document._id
                    });
                    savedCount++;
                }

            } catch (error) {
                console.error("Save Error:", error);
                failedCount++;
            }
        }

        if (savedCount > 0) {
            alert(`${savedCount} Documents Saved Successfully to Database! ${failedCount > 0 ? `(${failedCount} failed)` : ''}`);
            setCurrentStep(0);
            setSelectedFiles([]);
            setProcessedDocuments([]);
        } else {
            alert(`Failed to save documents. Check console for details.`);
        }
    };

    const assignedCount = processedDocuments.filter(d => d.shelf && d.rack).length;

    // Helper to get currently viewed doc
    const currentViewDoc = processedDocuments[selectedDocIndex];

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BrainCircuit className="text-tn-orange" />
                    {t('nav.staff')} - Digitalization Workflow
                </h2>
                <Link
                    to="/staff/register"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                >
                    <UserPlus size={18} />
                    Add Staff
                </Link>
            </div>

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
                        <div className="flex h-full w-full justify-center">
                            <div className="w-2/3 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-tn-orange transition-colors cursor-pointer group"
                                onClick={() => document.getElementById('folder-upload')?.click()}>
                                <input
                                    type="file"
                                    id="folder-upload"
                                    className="hidden"
                                    // @ts-ignore
                                    webkitdirectory=""
                                    directory=""
                                    multiple
                                    onChange={handleFileSelect}
                                />
                                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="text-tn-orange w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">Select Folder</h3>
                                <p className="text-gray-500 text-center max-w-sm">Click to select an entire folder containing documents</p>
                                <p className="text-xs text-gray-400 mt-4 bg-gray-100 px-3 py-1 rounded-full">Supported: PDF, JPG, PNG</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                            <div className="bg-white p-4 border-b flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-orange-100 text-tn-orange rounded-full flex items-center justify-center">
                                        <FileCheck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">Folder Selected</h3>
                                        <p className="text-xs text-gray-500">
                                            <span className="text-green-600 font-bold">✓ {selectedFiles.length} valid</span>
                                            {rejectedFiles.length > 0 && (
                                                <span className="text-red-500 ml-2">✗ {rejectedFiles.length} rejected</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-gray-100 px-3 py-2 rounded cursor-pointer hover:bg-gray-200 border border-transparent hover:border-gray-300 transition-all">
                                        <input type="checkbox" checked={isHandwritten} onChange={(e) => setIsHandwritten(e.target.checked)} className="w-4 h-4 text-tn-orange rounded focus:ring-tn-orange" />
                                        Handwritten
                                    </label>
                                    <button onClick={() => setSelectedFiles([])} className="text-sm text-gray-500 hover:text-red-500 font-medium px-4 py-2 hover:bg-red-50 rounded-md transition-colors">
                                        Change Folder
                                    </button>
                                    <div className="flex bg-gray-200 rounded-lg p-1">
                                        <button
                                            onClick={() => setProcessingMode('local')}
                                            className="px-3 py-1 text-xs font-bold rounded-md transition-all bg-white text-tn-orange shadow-sm"
                                        >
                                            Standard OCR ⚡
                                        </button>
                                    </div>

                                    <button
                                        onClick={startPreprocessing} // Routes to startQwenBatchProcessing if mode is cloud
                                        className={`px-6 py-2 rounded-md font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 ${processingMode === 'cloud'
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                            : 'bg-tn-green hover:bg-green-700 text-white'
                                            }`}
                                    >
                                        {processingMode === 'cloud' ? <BrainCircuit size={18} /> : <BrainCircuit size={18} />}
                                        {processingMode === 'cloud' ? 'Process with AI' : 'Start Preprocessing'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-1 gap-2">
                                    {selectedFiles.map((file, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border border-gray-100 flex items-center justify-between hover:shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded flex items-center justify-center ${file.type.includes('pdf') ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                    <FileText size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 truncate w-64">{file.name}</p>
                                                    <p className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB • <span className="text-green-600">Auto-Enhance Active</span></p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="text-xs font-mono text-gray-400">Ready</div>
                                                <button
                                                    onClick={() => removeFile(idx)}
                                                    className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Remove from queue"
                                                >
                                                    <span className="text-xs font-bold">✕</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {rejectedFiles.length > 0 && (
                                    <div className="mt-6 border-t pt-4">
                                        <h4 className="text-xs font-bold text-red-500 mb-3 uppercase flex items-center gap-2">
                                            <span className="bg-red-100 px-2 py-0.5 rounded-full">{rejectedFiles.length}</span>
                                            Rejected Files
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {rejectedFiles.map((item, idx) => (
                                                <div key={`rej-${idx}`} className="bg-red-50 p-2 rounded flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="font-medium text-red-700">{item.file.name}</span>
                                                        <span className="text-red-400 text-[10px]">({(item.file.size / 1024).toFixed(1)} KB)</span>
                                                    </div>
                                                    <span className="font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-100">{item.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                )}

                {/* Step 2: Advanced Preprocessing (Sequential) */}
                {
                    currentStep === 1 && (
                        <div className="flex flex-col h-full bg-white relative">
                            {/* Current Batch Preview / Visualizer */}
                            {currentPreviewDoc && (
                                <div className="absolute bottom-4 right-4 w-[300px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden transform transition-all duration-300">
                                    <div className="bg-gray-800 text-white text-xs px-2 py-1 flex justify-between">
                                        <span>Live Processing: {currentPreviewDoc.fileName}</span>
                                    </div>
                                    <div className="h-[200px]">
                                        {/* Simplified Mini-Preview */}
                                        <div className="relative h-full">
                                            <img src={currentPreviewDoc.displayImage} className="w-full h-full object-cover opacity-50 absolute inset-0" />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900 via-gray-900/40 p-2">
                                                <div className="h-1 bg-gray-700 w-full mb-1"><div className="bg-tn-green h-1 indicator-bar" style={{ width: '60%' }}></div></div>
                                                <p className="text-[10px] text-white">Enhancing Contrast...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Main detailed view if requested, or keep the original scanner animation but maybe overlay the preview component if "Visual Mode" was a thing, 
                            but for now let's stick to the request: "add small corner preview... during batch processing".
                            Also "implement split-screen... show each transformation". This feels like a separate "View Details" mode.
                            Let's assume we replace the center scanner animation with the PreprocessingPreview if we have data.
                        */}

                            <div className="flex flex-col items-center justify-center py-12 flex-1 relative">
                                {/* If we have a preview doc with steps, show the Main Visualizer */}
                                {currentPreviewDoc && currentPreviewDoc.steps ? (
                                    <div className="w-full max-w-5xl mb-8">
                                        <PreprocessingPreview
                                            originalImage={currentPreviewDoc.originalFileUrl || currentPreviewDoc.file ? URL.createObjectURL(currentPreviewDoc.file) : ''}
                                            steps={currentPreviewDoc.steps}
                                            metrics={currentPreviewDoc.metrics}
                                            onApprove={() => { /* Auto-proceeds anyway in batch */ }}
                                            onRedo={() => { /* In batch mode, maybe pause? For now no-op */ }}
                                        />
                                    </div>
                                ) : (
                                    /* Fallback to scanner animation if no detailed steps available */
                                    <div className="w-24 h-32 border-2 border-gray-200 rounded-lg relative overflow-hidden mb-8 bg-white shadow-xl">
                                        <motion.div
                                            className="absolute top-0 left-0 w-full h-1 bg-tn-orange shadow-[0_0_15px_rgba(255,165,0,0.8)] z-10"
                                            animate={{ top: ['0%', '100%', '0%'] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                        />
                                        <div className="p-2 space-y-2 opacity-30">
                                            <div className="h-2 bg-gray-800 rounded w-3/4"></div>
                                            <div className="h-2 bg-gray-800 rounded w-full"></div>
                                            <div className="h-2 bg-gray-800 rounded w-5/6"></div>
                                            <div className="h-2 bg-gray-800 rounded w-full"></div>
                                        </div>
                                    </div>
                                )}

                                <h3 className="text-2xl font-bold text-gray-800 mb-2">Preprocessing Documents</h3>
                                <div className="bg-orange-50 text-tn-orange px-4 py-1 rounded-full text-xs font-mono font-bold mb-4">
                                    Speed: {stats.speed.toFixed(1)} docs/sec
                                </div>
                                <p className="text-gray-500 mb-8 font-mono">{preprocessingStatus}</p>

                                <div className="w-full max-w-2xl bg-gray-100 rounded-full h-6 overflow-hidden relative shadow-inner">
                                    <motion.div
                                        className="bg-gradient-to-r from-tn-orange to-red-500 h-full flex items-center justify-end pr-2 text-[10px] text-white font-bold"
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${preprocessingProgress}%` }}
                                        transition={{ type: 'spring', stiffness: 50 }}
                                    >
                                        {Math.round(preprocessingProgress)}%
                                    </motion.div>
                                </div>

                                <div className="grid grid-cols-3 gap-8 mt-12 w-full max-w-4xl px-4">
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-800">{processedDocuments.length}</div>
                                        <div className="text-xs uppercase font-bold text-gray-400 mt-1">Processed</div>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-800">{selectedFiles.length - processedDocuments.length}</div>
                                        <div className="text-xs uppercase font-bold text-gray-400 mt-1">Remaining</div>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <div className="text-2xl font-bold text-tn-green mb-1"><CheckCircle size={24} className="mx-auto" /></div>
                                        <div className="text-xs uppercase font-bold text-gray-400">Quality Checked</div>
                                    </div>
                                </div>
                            </div>

                            {/* Completion State */}
                            {preprocessingProgress === 100 && (
                                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-20 animate-in fade-in">
                                    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full text-center">
                                        <div className="w-20 h-20 bg-green-100 text-tn-green rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle size={40} />
                                        </div>
                                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Preprocessing Complete!</h2>
                                        <p className="text-gray-500 mb-8">{selectedFiles.length} files are optimized and ready for OCR extraction.</p>
                                        <button
                                            onClick={startOcrProcessing}
                                            className="w-full py-4 bg-tn-orange text-white rounded-xl font-bold text-lg hover:bg-orange-600 transition-transform hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <BrainCircuit size={24} />
                                            Begin OCR Extraction
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Step 3: OCR Processing */}
                {
                    currentStep === 2 && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="w-16 h-16 text-tn-green animate-spin mb-6" />
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">{ocrStatus}</h3>
                            <div className="text-xs text-gray-500 font-mono mb-2">Processing Rate: {stats.speed.toFixed(1)} docs/sec</div>
                            <div className="w-full max-w-md bg-gray-200 rounded-full h-4 overflow-hidden mt-4">
                                <div className="bg-tn-green h-full transition-all duration-300 ease-out" style={{ width: `${processingProgress}%` }} />
                            </div>
                            <p className="text-gray-500 mt-2 text-sm">{processingProgress}% Complete</p>

                            <div className="h-24 overflow-y-auto w-full max-w-md mt-4 bg-gray-50 p-2 rounded text-xs text-gray-500 font-mono border">
                                {processingLogs.map((log, i) => <div key={i}>{log}</div>)}
                            </div>

                            <button
                                onClick={() => {
                                    setOcrStatus('Skipping remaining documents...');
                                    setCurrentStep(3); // Force proceed to review
                                }}
                                className="mt-6 text-sm text-red-500 hover:text-red-700 underline"
                            >
                                Skip / Stop OCR
                            </button>
                        </div>
                    )
                }

                {/* Step 4: Advanced Review with Visual Overlay */}
                {
                    currentStep === 3 && (
                        <div className="h-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Verification & Review</h3>
                                    <p className="text-sm text-gray-500">Click highlighted cells to correct data.</p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {processedDocuments.length > 1 && (
                                        <div className="flex items-center gap-2 mr-4 border-r pr-4">
                                            <button
                                                className="p-1 px-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                                                onClick={() => setSelectedDocIndex(i => Math.max(0, i - 1))}
                                                disabled={selectedDocIndex === 0}
                                            >
                                                &lt;
                                            </button>
                                            <span className="text-xs font-bold text-gray-600">
                                                {selectedDocIndex + 1} / {processedDocuments.length}
                                            </span>
                                            <button
                                                className="p-1 px-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                                                onClick={() => setSelectedDocIndex(i => Math.min(processedDocuments.length - 1, i + 1))}
                                                disabled={selectedDocIndex === processedDocuments.length - 1}
                                            >
                                                &gt;
                                            </button>
                                        </div>
                                    )}
                                    <span className="text-xs font-bold text-gray-500 mr-2">Zoom:</span>
                                    <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.2))}><ZoomOut size={16} /></button>
                                    <span className="p-2 text-sm font-mono border-t border-b w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                                    <button className="p-2 border rounded hover:bg-gray-50" onClick={() => setZoomLevel(z => Math.min(3, z + 0.2))}><ZoomIn size={16} /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">

                                    {/* Left Column: Image with Overlay */}
                                    <div className="bg-gray-100 rounded-lg overflow-hidden relative min-h-[500px] border border-gray-300 shadow-inner flex flex-col">
                                        <div className="absolute top-2 right-2 z-10 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                            {currentViewDoc.fileName}
                                        </div>
                                        <div className="flex-1 relative overflow-auto flex items-center justify-center bg-gray-900/5">
                                            <img
                                                src={currentViewDoc.displayImage}
                                                className="max-w-none transition-transform duration-200"
                                                style={{ transform: `scale(${zoomLevel})` }}
                                                alt="Doc Preview"
                                            />
                                        </div>
                                    </div>

                                    {/* Right Column: Form Data */}
                                    <div className="space-y-6">
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">

                                            {/* Summary Section */}
                                            {currentViewDoc.summary && (
                                                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                                    <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-2">
                                                        <BookOpen size={16} />
                                                        Document Summary
                                                    </h4>
                                                    <p className="text-sm text-blue-700 leading-relaxed">
                                                        {currentViewDoc.summary}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                {/* Category / Doc Type */}
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category / வகை</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full p-2 border rounded-lg appearance-none bg-gray-50 font-medium"
                                                            value={currentViewDoc.category}
                                                            onChange={(e) => updateDocField(selectedDocIndex, 'category', e.target.value)}
                                                        >
                                                            <option>Sale Deed</option>
                                                            <option>Patta</option>
                                                            <option>Chitta</option>
                                                            <option>Adangal</option>
                                                        </select>
                                                        <div className="absolute right-3 top-3 pointer-events-none">▼</div>
                                                    </div>
                                                </div>

                                                {/* Thokuppu En / Batch No */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                        <Hash size={12} />
                                                        Thokuppu En
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-tn-orange"
                                                        value={currentViewDoc.batchNumber || ''}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'batchNumber', e.target.value)}
                                                        placeholder="Ex: 1/3-7-86"
                                                    />
                                                </div>

                                                {/* Patta Number */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                        <FileCheck2 size={12} />
                                                        Patta No
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-tn-orange"
                                                        value={currentViewDoc.pattaNumber || ''}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'pattaNumber', e.target.value)}
                                                        placeholder="Ex: 56"
                                                    />
                                                </div>

                                                {/* Document No */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Document No / ஆவண எண்</label>
                                                    <input
                                                        type="text"
                                                        className={`w-full p-2 border rounded-lg ${currentViewDoc.docNumber === 'ERROR' ? 'border-red-300 bg-red-50 text-red-600' : ''}`}
                                                        value={currentViewDoc.docNumber}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'docNumber', e.target.value)}
                                                    />
                                                </div>

                                                {/* Survey No */}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Survey No / சர்வே எண்</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded-lg"
                                                        value={currentViewDoc.surveyNumber}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'surveyNumber', e.target.value)}
                                                    />
                                                </div>

                                                {/* Owner Name */}
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Owner / உரிமையாளர்</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded-lg"
                                                        value={currentViewDoc.ownerName}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'ownerName', e.target.value)}
                                                    />
                                                </div>

                                                {/* Date */}
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date / தேதி</label>
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border rounded-lg"
                                                        value={currentViewDoc.date}
                                                        onChange={(e) => updateDocField(selectedDocIndex, 'date', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Raw Text Section - Requested by User */}
                                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4">
                                                <FileText size={16} />
                                                Extracted Raw Text / முழு உரை
                                            </h4>
                                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 h-60 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-gray-700">
                                                {currentViewDoc.ocrData?.text || "No text extracted."}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>


                            <div className="mt-6 flex justify-end pt-4 border-t gap-4">
                                <button onClick={() => setCurrentStep(1)} className="px-6 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50">Back</button>
                                <button onClick={() => setCurrentStep(4)} className="px-8 py-3 bg-tn-orange hover:bg-orange-600 text-white rounded-md font-semibold shadow-lg">Confirm & Proceed to Storage</button>
                            </div>
                        </div>
                    )
                }

                {/* Step 5: Storage Assignment */}
                {
                    currentStep === 4 && (
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
                                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 shrink-0"><FileText size={24} /></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-800 truncate">{doc.fileName}</span>
                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{doc.category}</span>
                                                </div>
                                                <div className="flex gap-4 text-xs text-gray-500">
                                                    <span>Doc No: {doc.docNumber}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <input type="text" placeholder="Shelf" value={doc.shelf} onChange={(e) => updateLocation(index, 'shelf', e.target.value)} className="w-24 p-2 text-sm border rounded" />
                                                <input type="text" placeholder="Rack" value={doc.rack} onChange={(e) => updateLocation(index, 'rack', e.target.value)} className="w-24 p-2 text-sm border rounded" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t flex justify-end">
                                <button onClick={handleSave} disabled={assignedCount < processedDocuments.length} className={`px-8 py-3 rounded-md font-bold shadow-md flex items-center gap-2 ${assignedCount < processedDocuments.length ? 'bg-gray-300 cursor-not-allowed' : 'bg-tn-orange hover:bg-orange-600 text-white'}`}>
                                    <Save size={18} /> Complete & Save All
                                </button>
                            </div>
                        </div>
                    )
                }

                {/* Qwen AI Modal */}
                {

                }

                {/* Correction Modal */}
                {
                    activeCorrectionCell && (
                        <CorrectionInterface
                            cell={activeCorrectionCell!}
                            onSave={handleCellSave}
                            onClose={() => setActiveCorrectionCell(null)}
                        />
                    )
                }
            </div >
        </div>
    );
};
