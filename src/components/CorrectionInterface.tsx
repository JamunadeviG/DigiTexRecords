import React, { useState, useEffect } from 'react';
import { X, Check, Keyboard, RefreshCw } from 'lucide-react';
import type { CellData } from '../services/imageProcessing';

interface CorrectionInterfaceProps {
    cell: CellData;
    onSave: (cellId: number, newText: string) => void;
    onClose: () => void;
}

export const CorrectionInterface: React.FC<CorrectionInterfaceProps> = ({ cell, onSave, onClose }) => {
    const [text, setText] = useState(cell.text || '');
    const [showTamilKeyboard, setShowTamilKeyboard] = useState(false);

    useEffect(() => {
        setText(cell.text || '');
    }, [cell]);

    // Simple Tamil Virtual Keyboard Layout (Common characters)
    const tamilChars = [
        'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ',
        'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன',
        'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ', '்'
    ];

    const insertChar = (char: string) => {
        setText(prev => prev + char);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        Correction Needed
                        <span className={`text-xs px-2 py-0.5 rounded ${cell.confidence && cell.confidence > 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            Conf: {Math.round(cell.confidence || 0)}%
                        </span>
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Visual Comparison */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Original Extract</label>
                            <div className="border rounded bg-gray-50 p-2 h-24 flex items-center justify-center overflow-hidden">
                                <img src={cell.imageData} alt="Cell" className="max-w-full max-h-full object-contain" />
                            </div>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Corrected Text</label>
                            <button
                                onClick={() => setShowTamilKeyboard(!showTamilKeyboard)}
                                className={`text-xs flex items-center gap-1 px-2 py-1 rounded border ${showTamilKeyboard ? 'bg-tn-orange text-white border-tn-orange' : 'text-gray-600 bg-gray-100'}`}
                            >
                                <Keyboard size={12} /> Tamil Keys
                            </button>
                        </div>

                        <div className="relative">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full border-2 border-tn-orange rounded p-3 text-lg font-mono focus:outline-none min-h-[80px]"
                                placeholder="Enter correct text..."
                                autoFocus
                            />
                        </div>

                        {/* Virtual Keyboard */}
                        {showTamilKeyboard && (
                            <div className="mt-2 p-2 bg-gray-100 rounded border grid grid-cols-10 gap-1 text-center">
                                {tamilChars.map(char => (
                                    <button
                                        key={char}
                                        onClick={() => insertChar(char)}
                                        className="p-1 bg-white hover:bg-orange-50 rounded shadow-sm text-sm font-bold border border-gray-200"
                                    >
                                        {char}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Suggestions (Mock) */}
                    {(cell.confidence || 0) < 60 && (
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm md:flex gap-2 items-center hidden">
                            <span className="font-bold text-yellow-800">Suggestion:</span>
                            <button onClick={() => setText("நில அளவை")} className="underline ml-2 text-yellow-700 hover:text-yellow-900">நில அளவை</button>
                            <button onClick={() => setText("பட்டா")} className="underline ml-2 text-yellow-700 hover:text-yellow-900">பட்டா</button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t flex justify-end gap-3">
                    <button
                        onClick={() => setText(cell.text || '')}
                        className="p-2 text-gray-500 hover:text-gray-700"
                        title="Reset to Original OCR"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        onClick={() => onSave(cell.id, text)}
                        className="px-6 py-2 bg-tn-green hover:bg-green-700 text-white rounded font-bold flex items-center gap-2 shadow-sm"
                    >
                        <Check size={18} /> Save Correction
                    </button>
                </div>
            </div>
        </div>
    );
};
