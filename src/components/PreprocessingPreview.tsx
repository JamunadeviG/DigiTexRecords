import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, Grid, Layers, CheckCircle, RefreshCcw, Activity } from 'lucide-react';

interface PreprocessingPreviewProps {
    originalImage: string;
    steps: { name: string; image: string }[];
    metrics?: {
        skew: number;
        contrastImprovement: number;
        qualityScore: number;
    };
    currentStepIndex?: number;
    onApprove: () => void;
    onRedo: () => void;
}

export const PreprocessingPreview: React.FC<PreprocessingPreviewProps> = ({
    originalImage,
    steps,
    metrics,
    currentStepIndex = steps.length - 1,
    onApprove,
    onRedo
}) => {
    const [viewMode, setViewMode] = useState<'split' | 'grid'>('split');
    const [zoom, setZoom] = useState(1);
    const [sliderPos, setSliderPos] = useState(50);
    const [autoPlayIndex, setAutoPlayIndex] = useState(0);

    const currentImage = steps[Math.min(autoPlayIndex, steps.length - 1)]?.image || originalImage;
    const currentLabel = steps[Math.min(autoPlayIndex, steps.length - 1)]?.name || 'Loading...';

    // Auto-play steps effect
    useEffect(() => {
        if (autoPlayIndex < currentStepIndex) {
            const timer = setTimeout(() => {
                setAutoPlayIndex(prev => Math.min(prev + 1, steps.length - 1));
            }, 500); // 500ms transition per step
            return () => clearTimeout(timer);
        } else {
            setAutoPlayIndex(currentStepIndex); // Sync if provided index changes
        }
    }, [currentStepIndex, autoPlayIndex, steps.length]);


    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200 flex flex-col h-[600px]">
            {/* Header */}
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Activity size={18} className="text-tn-orange" />
                        Preprocessing Visualization
                    </h3>
                    <p className="text-xs text-gray-500">Step {autoPlayIndex + 1} of {steps.length}: {currentLabel}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setViewMode('split')} className={`p-2 rounded ${viewMode === 'split' ? 'bg-white shadow text-tn-orange' : 'text-gray-400'}`}><Layers size={18} /></button>
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow text-tn-orange' : 'text-gray-400'}`}><Grid size={18} /></button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
                {viewMode === 'split' ? (
                    <div className="relative w-full h-full flex items-center justify-center select-none"
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSliderPos(((e.clientX - rect.left) / rect.width) * 100);
                        }}>

                        {/* Comparison Container */}
                        <div className="relative w-full h-full max-w-4xl max-h-full aspect-video">
                            {/* Underlying (Processed) */}
                            <img
                                src={currentImage}
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ transform: `scale(${zoom})` }}
                            />

                            {/* Overlying (Original) - Clipped */}
                            <div className="absolute inset-0 overflow-hidden border-r-2 border-white/50 shadow-xl"
                                style={{ width: `${sliderPos}%` }}>
                                <img
                                    src={originalImage}
                                    className="absolute top-0 left-0 w-full h-full object-contain max-w-none"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${zoom})` }} // Fix for clip logic
                                />
                                <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 text-xs rounded">Original</div>
                            </div>
                            <div className="absolute top-4 right-4 bg-tn-orange/80 text-white px-2 py-1 text-xs rounded">{currentLabel}</div>

                            {/* Slider Handle */}
                            <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_black]" style={{ left: `${sliderPos}%` }}>
                                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-400">
                                    ↔
                                </div>
                            </div>
                        </div>

                        {/* Controls Overlay */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 rounded-full px-4 py-2 flex gap-4 text-white backdrop-blur-md">
                            <button onClick={() => setZoom(z => Math.max(1, z - 0.2))}><ZoomOut size={16} /></button>
                            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}><ZoomIn size={16} /></button>
                            <button onClick={() => setZoom(1)}><Maximize2 size={16} /></button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 p-4 w-full h-full overflow-y-auto">
                        <div className="aspect-video bg-black relative rounded overflow-hidden border border-gray-700">
                            <img src={originalImage} className="w-full h-full object-contain" />
                            <span className="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-2 py-1 w-full">Original</span>
                        </div>
                        {steps.map((step, idx) => (
                            <div key={idx} className={`aspect-video bg-black relative rounded overflow-hidden border ${idx === autoPlayIndex ? 'border-tn-orange ring-2 ring-tn-orange/30' : 'border-gray-700'}`}>
                                <img src={step.image} className="w-full h-full object-contain" />
                                <span className="absolute bottom-0 left-0 bg-black/60 text-white text-[10px] px-2 py-1 w-full">{idx + 1}. {step.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Metrics Footer */}
            <div className="bg-white border-t p-4 flex justify-between items-center">
                <div className="flex gap-6">
                    {metrics && (
                        <>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">Contrast</span>
                                <span className="text-sm font-bold text-green-600">+{metrics.contrastImprovement}%</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">Skew Fix</span>
                                <span className="text-sm font-bold text-blue-600">{metrics.skew}°</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-bold">Quality</span>
                                <div className={`text-sm font-bold ${metrics.qualityScore > 80 ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {metrics.qualityScore}/100
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={onRedo} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-600">
                        <RefreshCcw size={16} /> Adjust
                    </button>
                    <button onClick={onApprove} className="px-6 py-2 bg-tn-green text-white rounded hover:bg-green-700 flex items-center gap-2 text-sm font-bold shadow-md">
                        <CheckCircle size={16} /> Approve
                    </button>
                </div>
            </div>
        </div>
    );
};
