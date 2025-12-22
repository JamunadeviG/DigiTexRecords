import React, { useRef, useState, useEffect } from 'react';
import type { TableStructure, CellData } from '../services/imageProcessing';

interface OcrOverlayProps {
    imageSrc: string;
    tableData?: TableStructure;
    onCellClick?: (cell: CellData) => void;
    highlightConfidence?: boolean;
    zoomLevel?: number;
}

export const OcrOverlay: React.FC<OcrOverlayProps> = ({
    imageSrc,
    tableData,
    onCellClick,
    highlightConfidence = true,
    zoomLevel = 1
}) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [scale, setScale] = useState(1);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (loaded && imgRef.current) {
            // Calculate scale: Displayed Width / Original Image Width
            // Note: This needs the image to be fully loaded to get naturalWidth
            const updateScale = () => {
                const img = imgRef.current;
                if (img && img.naturalWidth > 0) {
                    // We simply use 1 if we are controlling zoom externally via transform
                    // But if the container constrains width, we need to know.
                    // Assuming the image is rendered at natural size * zoomLevel context? 
                    // Or style width=100%?

                    // Let's assume the overlay matches the image dimensions 1:1 in the DOM, 
                    // and we scale both with a wrapper.
                    // If the parent scales the image, we don't need to calculate scale here if we overlay absolutely.
                    // However, if we just render div boxes, they need to match pixel coords.

                    // Simplest approach: The container is relative. The image is width:100% or auto.
                    // We calculate ratio = currentWidth / naturalWidth
                    const currentWidth = img.offsetWidth;
                    setScale(currentWidth / img.naturalWidth);
                }
            };

            updateScale();
            window.addEventListener('resize', updateScale);
            return () => window.removeEventListener('resize', updateScale);
        }
    }, [loaded, zoomLevel, imageSrc]);

    const getConfidenceColor = (confidence?: number, needsReview?: boolean) => {
        if (needsReview) return 'rgba(239, 68, 68, 0.4)'; // Red
        if (!confidence && confidence !== 0) return 'rgba(59, 130, 246, 0.2)'; // Blue (Unknown)
        if (confidence >= 80) return 'rgba(34, 197, 94, 0.2)'; // Green
        if (confidence >= 60) return 'rgba(234, 179, 8, 0.3)'; // Yellow
        return 'rgba(239, 68, 68, 0.4)'; // Red
    };

    const getBorderColor = (confidence?: number, needsReview?: boolean) => {
        if (needsReview) return '#EF4444';
        if (!confidence) return '#3B82F6';
        if (confidence >= 80) return '#22C55E';
        if (confidence >= 60) return '#EAB308';
        return '#EF4444';
    };

    return (
        <div className="relative inline-block w-full" style={{ transformOrigin: 'top left' }}>
            <img
                ref={imgRef}
                src={imageSrc}
                alt="Document Analysis"
                className="w-full h-auto block"
                onLoad={() => setLoaded(true)}
            />

            {loaded && tableData && tableData.cells.map((cell) => (
                <div
                    key={cell.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        onCellClick?.(cell);
                    }}
                    className="absolute cursor-pointer transition-colors hover:bg-white/40 group z-10"
                    style={{
                        left: `${cell.x * scale}px`,
                        top: `${cell.y * scale}px`,
                        width: `${cell.width * scale}px`,
                        height: `${cell.height * scale}px`,
                        backgroundColor: highlightConfidence ? getConfidenceColor(cell.confidence, cell.needsReview) : 'transparent',
                        border: `1px solid ${highlightConfidence ? getBorderColor(cell.confidence, cell.needsReview) : 'rgba(0,0,0,0.3)'}`
                    }}
                    title={`Confidence: ${Math.round(cell.confidence || 0)}% ${cell.needsReview ? '(Needs Review)' : ''}`}
                >
                    {/* Tooltip or Label on Hover */}
                    {(cell.text) && (
                        <div className="absolute opacity-0 group-hover:opacity-100 bg-black/80 text-white text-[10px] p-1 rounded -top-6 left-0 whitespace-nowrap z-20 pointer-events-none">
                            {cell.text.substring(0, 20)}...
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
