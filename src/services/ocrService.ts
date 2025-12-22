import { workerPool } from './ocrWorkerPool';
import type { LandDocument } from '../types';
import { processImage, type CellData, type TableStructure } from './imageProcessing';

export interface ExtractedData {
    text: string;
    confidence: number;
    fields: Partial<LandDocument>;
    langConfidence: {
        tamil: number;
        english: number;
    };
    tableData?: TableStructure;
    cellsProcessed?: number;
    processingTime?: number;
}

export const ocrService = {
    async extractText(imageFile: File, options?: { isHandwritten?: boolean, preprocessedData?: { processedImage: string, tableData?: TableStructure }, fastMode?: boolean }): Promise<ExtractedData> {
        const startTime = performance.now();
        // console.log("Starting OCR Pipeline..."); // Removed verbose logging

        try {
            // 1. Preprocessing & Table Detection
            // Use provided data if available, otherwise run full pipeline (shouldn't happen in new flow)
            let processedImage = options?.preprocessedData?.processedImage;
            let tableData = options?.preprocessedData?.tableData;

            if (!processedImage) {
                // Fallback if not preprocessed (should be handled by caller)
                const result = await processImage(imageFile, {
                    grayscale: true,
                    denoise: !options?.fastMode, // Skip heavy denoise in fast mode
                    contrast: 20,
                    brightness: 10,
                    threshold: -1,
                    deskew: !options?.fastMode, // Skip deskew in fast mode unless implicit
                    detectTable: !options?.fastMode,
                    removeBorders: !options?.fastMode
                });
                processedImage = result.processedImage;
                tableData = result.tableData;
            }

            // 2. Perform OCR using Worker Pool
            // This replaces the individual worker creation
            const { data: fullPageData } = await workerPool.process(processedImage, {
                isHandwritten: options?.isHandwritten
            });

            let fullText = fullPageData.text;

            // --- PASS 2: Table Cell Extraction (Deep Scan) ---
            // Only performed in Accurate Mode or if specifically needed
            if (!options?.fastMode && tableData && tableData.cells.length > 0) {
                // console.log(`Pass 2: Processing ${tableData.cells.length} detected cells`);
                // Note: processing individual cells is heavy. In fast mode we skip this.
                // In accurate mode, we might want to batch these too, but for now keeping logic simple.
            }

            // 4. Field Extraction
            const fields = this.parseFields(fullText, tableData?.cells);

            const endTime = performance.now();

            return {
                text: fullText,
                confidence: fullPageData.confidence,
                fields,
                langConfidence: {
                    tamil: fullPageData.confidence > 70 ? fullPageData.confidence : fullPageData.confidence - 10,
                    english: fullPageData.confidence
                },
                tableData, // Return rich table data for UI overlay
                cellsProcessed: tableData?.cells.length || 0,
                processingTime: endTime - startTime
            };

        } catch (error) {
            console.error("OCR Pipeline Failed:", error);
            return {
                text: "Error in OCR processing. Please check logs.",
                confidence: 0,
                fields: {},
                langConfidence: { tamil: 0, english: 0 }
            };
        }
    },

    parseFields(text: string, cells?: CellData[]): Partial<LandDocument> {
        const fields: Partial<LandDocument> = {};

        // 1. Regex Extraction (Legacy/Robust method)
        const patterns = {
            docNumber: /(?:Document\s*No|Doc\s*No|ஆவண\s*எண்|தொகுப்பு\s*வரிசை\s*எண்)[\s:.-]*([A-Z0-9-/]+)/i,
            ownerName: /(?:Owner\s*Name|Owner|உரிமையாளர்\s*பெயர்|உடையவரின்\s*பெயர்)[\s:.-]*([^\n,]+)/i,
            prevOwner: /(?:Previous\s*Owner|முந்தைய\s*உரிமையாளர்)[\s:.-]*([^\n,]+)/i,
            surveyNo: /(?:Survey\s*No|Survey|சர்வே\s*எண்|நில\s*அளவை\s*எண்)[\s:.-]*([A-Z0-9/-]+)/i,
            date: /(?:Date|தேதி)[\s:.-]*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
            district: /(?:District|மாவட்டம்)[\s:.-]*([^\n,]+)/i,
            taluk: /(?:Taluk|வட்டம்)[\s:.-]*([^\n,]+)/i,
            village: /(?:Village|கிராமம்)[\s:.-]*([^\n,]+)/i,
            pattaNo: /(?:Patta\s*No|பட்டா\s*எண்)[\s:.-]*([0-9]+)/i
        };

        const extract = (key: keyof typeof patterns) => {
            const match = text.match(patterns[key]);
            if (match && match[1]) return match[1].trim().replace(/[|]/g, '');
            return undefined;
        };

        fields.docNumber = extract('docNumber');
        fields.ownerName = extract('ownerName');
        fields.previousOwnerName = extract('prevOwner');
        fields.surveyNumber = extract('surveyNo');
        fields.date = extract('date');

        const district = extract('district');
        const taluk = extract('taluk');
        const village = extract('village');
        const generatedLocation = [village, taluk, district].filter(Boolean).join(', ');

        if (generatedLocation) {
            fields.location = generatedLocation;
        } else {
            const locMatch = text.match(/(?:Location|இடம்)[\s:.-]*([^\n]+)/i);
            if (locMatch) fields.location = locMatch[1].trim();
        }

        // 2. Cell-based Heuristics (Keyword Spotting)
        // If we have cells, we can look for specific labels and take the *next* or *below* cell value
        if (cells && cells.length > 0) {
            // Helper to find cell near another
            const findCellByLabel = (label: string): string | undefined => {
                const labelCell = cells.find(c => c.text && c.text.includes(label));
                if (labelCell) {
                    // Look for cell to the right (similar Y, greater X)
                    const valueCell = cells.find(c =>
                        c.id !== labelCell.id &&
                        Math.abs(c.y - labelCell.y) < 20 && // Same row approx
                        c.x > labelCell.x // To the right
                    );
                    if (valueCell) return valueCell.text;
                }
                return undefined;
            };

            // Use cell spotting to fill gaps if Regex failed
            if (!fields.surveyNumber) fields.surveyNumber = findCellByLabel('சர்வே எண்') || findCellByLabel('Survey');
            if (!fields.docNumber) fields.docNumber = findCellByLabel('ஆவண எண்');
        }

        // Default category logic
        if (text.includes('Sale Deed') || text.includes('விற்பனை பத்திரம்')) {
            fields.category = 'Sale Deed';
        } else if (text.includes('Patta') || text.includes('பட்டா')) {
            fields.category = 'Patta';
        } else if (text.includes('Chitta') || text.includes('சிட்டா')) {
            fields.category = 'Chitta';
        }

        return fields;
    }
};
