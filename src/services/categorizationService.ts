import type { DocCategory } from '../types';

export interface CategoryResult {
    category: DocCategory;
    confidence: number;
    keywordsFound: string[];
}

export const CATEGORY_DEFINITIONS = [
    {
        id: 'C1',
        name: 'Sale Deed',
        label: 'வில்லங்கம் / Sale Deed',
        keywords: ['வில்லங்கம்', 'விற்பனை', 'கொடுத்தவர்', 'வாங்கியவர்', 'sale deed', 'transfer', 'vendor', 'purchaser', 'document no']
    },
    {
        id: 'C2',
        name: 'Patta',
        label: 'பட்டா / Patta',
        keywords: ['பட்டா', 'patta', 'chitta', 'உடைமையாளர்', 'owner', 'manai', 'natham']
    },
    {
        id: 'C3',
        name: 'Adangal',
        label: 'அடங்கல் / Adangal',
        keywords: ['அடங்கல்', 'adangal', 'பயிர்', 'crop', 'cultivation', 'fasli', 'பசலி']
    },
    {
        id: 'C4',
        name: 'Chitta',
        label: 'சிட்டா / Chitta',
        keywords: ['சிட்டா', 'chitta', 'நன்செய்', 'புன்செய்', 'wet land', 'dry land']
    },
    {
        id: 'C5',
        name: 'FMB',
        label: 'FMB / Sketch',
        keywords: ['FMB', 'field measurement', 'survey map', 'எல்லை', 'boundary', 'sketch', 'வரைபடம்']
    },
    {
        id: 'C6',
        name: 'Kudumba Patta',
        label: 'குடும்ப பட்டா',
        keywords: ['குடும்ப', 'family', 'joint patta', 'கூட்டு']
    },
    {
        id: 'C7',
        name: 'Encumbrance Certificate',
        label: 'EC / வில்லங்க சான்று',
        keywords: ['ec', 'encumbrance', 'வில்லங்க சான்று', 'certificate']
    }
];

export const categorizeDocument = (text: string): CategoryResult => {
    const lowerText = text.toLowerCase();
    let highestScore = 0;
    let bestCategory: DocCategory = 'Other';
    let bestKeywords: string[] = [];

    // Simple scoring: +1 for each keyword occurrence
    CATEGORY_DEFINITIONS.forEach(def => {
        let score = 0;
        const found: string[] = [];

        def.keywords.forEach(kw => {
            const regex = new RegExp(kw.toLowerCase(), 'g');
            const matches = lowerText.match(regex);
            if (matches) {
                score += matches.length; // Weight by frequency
                if (!found.includes(kw)) found.push(kw);
            }
        });

        if (score > highestScore) {
            highestScore = score;
            bestCategory = def.name as DocCategory;
            bestKeywords = found;
        }
    });

    // Normalize confidence (arbitrary heuristic: >5 matches = 90%+, 1 match = ~20%)
    // Cap at 100
    const confidence = Math.min(Math.round((highestScore / 10) * 100) + 20, 100);

    // Heuristic: If confidence is very low, stick to 'Other' or 'Sale Deed' default?
    // Let's return the best guess but low confidence
    if (highestScore === 0) {
        return { category: 'Sale Deed', confidence: 0, keywordsFound: [] }; // Default fallback
    }

    return {
        category: bestCategory,
        confidence: confidence,
        keywordsFound: bestKeywords
    };
};
