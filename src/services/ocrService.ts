// server-side OCR service (switched from Tesseract.js)
interface OCRResult {
    text: string;
    confidence: number;
    fields: Record<string, string>;
    blocks?: any[];
}

interface OCROptions {
    isHandwritten?: boolean;
    preprocessedData?: {
        processedImage?: string;
        tableData?: any;
    };
    fastMode?: boolean;
}

class OcrService {
    // simplified service that calls the backend

    public async extractText(file: File, options: OCROptions = {}): Promise<OCRResult> {
        console.log(`[OCR Service] Uploading ${file.name} to server for EasyOCR...`);

        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await fetch('http://localhost:5000/api/ocr/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server OCR Failed');
            }

            const data = await response.json();

            // Map server response to expected interface
            return {
                text: data.text || "",
                confidence: data.confidence || 0,
                fields: {
                    docNumber: data.structuredData?.docNumber || "",
                    date: data.structuredData?.date || "",
                    surveyNumber: data.structuredData?.surveyNumber || "",
                    category: data.structuredData?.category || "Sale Deed",
                    ownerName: "", // EasyOCR might not identify this easily yet
                    // ... map other fields if needed ...
                },
                blocks: data.structuredData?.blocks
            };

        } catch (error) {
            console.error("OCR API Error:", error);
            throw error;
        }
    }
}

export const ocrService = new OcrService();
