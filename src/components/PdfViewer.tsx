
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PdfViewerProps {
    fileUrl: string;
    zoomLevel: number;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, zoomLevel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);

    // Load PDF Document
    useEffect(() => {
        const loadPdf = async () => {
            try {
                setLoading(true);
                // @ts-ignore
                if (!window.pdfjsLib) {
                    console.error("PDF.js library not loaded");
                    return;
                }

                // @ts-ignore
                const loadingTask = window.pdfjsLib.getDocument(fileUrl);
                const doc = await loadingTask.promise;

                setPdfDoc(doc);
                setNumPages(doc.numPages);
                setCurrentPage(1);
                setLoading(false);
            } catch (error) {
                console.error("Error loading PDF:", error);
                setLoading(false);
            }
        };

        if (fileUrl) {
            loadPdf();
        }
    }, [fileUrl]);

    // Render Page
    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;

            try {
                const page = await pdfDoc.getPage(currentPage);

                // Calculate scale based on zoomLevel
                // We base it on a standard scale of 1.5 for readability * zoomLevel
                const viewport = page.getViewport({ scale: zoomLevel * 1.5 });

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport,
                    };

                    await page.render(renderContext).promise;
                }
            } catch (error) {
                console.error("Error rendering page:", error);
            }
        };

        renderPage();
    }, [pdfDoc, currentPage, zoomLevel]);

    const changePage = (offset: number) => {
        setPdfDoc((prevDoc: any) => {
            if (!prevDoc) return null;
            const newPage = currentPage + offset;
            if (newPage >= 1 && newPage <= prevDoc.numPages) {
                setCurrentPage(newPage);
            }
            return prevDoc;
        });
    };

    if (loading) {
        return <div className="flex items-center justify-center p-10 text-gray-500">Loading PDF...</div>;
    }

    return (
        <div className="flex flex-col items-center bg-gray-900/50 p-4 rounded min-h-[500px]">
            {/* Pagination Controls */}
            <div className="flex items-center gap-4 mb-4 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm sticky top-0 z-10">
                <button
                    onClick={() => changePage(-1)}
                    disabled={currentPage <= 1}
                    className="p-1 rounded-full hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-white font-mono text-sm shadow-black drop-shadow-md">
                    Page {currentPage} of {numPages}
                </span>
                <button
                    onClick={() => changePage(1)}
                    disabled={currentPage >= numPages}
                    className="p-1 rounded-full hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Canvas */}
            <div className="shadow-2xl border border-gray-700 bg-white">
                <canvas ref={canvasRef} className="block max-w-full" />
            </div>
        </div>
    );
};
