import { createWorker, PSM } from 'tesseract.js';
import type { LandDocument } from '../types';

export interface ExtractedData {
    text: string;
    confidence: number;
    fields: Partial<LandDocument>;
    langConfidence: {
        tamil: number;
        english: number;
    };
}

export const ocrService = {
    async extractText(imageFile: File, options?: { isHandwritten?: boolean }): Promise<ExtractedData> {
        try {
            // Initialize worker for Tamil and English
            const worker = await createWorker('tam+eng');

            // Set parameters based on document type
            await worker.setParameters({
                tessedit_ocr_engine_mode: 1, // LSTM only
                tessedit_pageseg_mode: options?.isHandwritten ? PSM.SINGLE_BLOCK : PSM.AUTO_OSD, // 6 = Uniform block (better for forms/dense text), 1 = Auto with OSD
                preserve_interword_spaces: options?.isHandwritten ? '1' : '0'
            });

            // Recognize text
            const { data } = await worker.recognize(imageFile);

            // Terminate worker to free resources
            await worker.terminate();

            // Analyze confidence
            const confidence = data.confidence;

            // Simple heuristic to guess language confidence
            const langConfidence = {
                tamil: confidence > 70 ? confidence - 5 : confidence,
                english: confidence > 80 ? confidence : confidence + 5
            };

            // Parse fields using regex specifically for Tamil/English patterns
            const fields = this.parseFields(data.text);

            return {
                text: data.text,
                confidence,
                fields,
                langConfidence
            };
        } catch (error) {
            console.error("OCR Failed:", error);
            return {
                text: "Error in OCR processing. Please enter data manually.",
                confidence: 0,
                fields: {},
                langConfidence: { tamil: 0, english: 0 }
            };
        }
    },

    parseFields(text: string): Partial<LandDocument> {
        const fields: Partial<LandDocument> = {};

        // Extended Regex Patterns for Land Records
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

        // Extract and helper to clean
        const extract = (key: keyof typeof patterns) => {
            const match = text.match(patterns[key]);
            if (match && match[1]) return match[1].trim().replace(/[|]/g, ''); // Clean artifacts
            return undefined;
        };

        fields.docNumber = extract('docNumber');
        fields.ownerName = extract('ownerName');
        fields.previousOwnerName = extract('prevOwner');
        fields.surveyNumber = extract('surveyNo');
        fields.date = extract('date');

        // Composite location from District/Taluk/Village if found, else generic Location
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

        // Additional field checks
        const pattaNo = extract('pattaNo');
        if (pattaNo && !fields.docNumber) {
            fields.docNumber = `PATTA-${pattaNo}`; // Fallback if doc no missing but patta exists
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
