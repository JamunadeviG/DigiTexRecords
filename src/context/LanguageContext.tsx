import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'ta';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: {
        'app.title': 'Tamil Nadu Land Registry',
        'nav.staff': 'Staff Portal',
        'nav.public': 'Public Search',
        'hero.title': 'Digital Land Records System',
        'hero.subtitle': 'Transparent, Secure, and Accessible Land Records for Tamil Nadu',
        'btn.login': 'Staff Login',
        'btn.search': 'Search Records',
        'upload.title': 'Upload Documents',
        'upload.desc': 'Drag & drop scanned land documents here',
        'search.placeholder': 'Enter Owner Name, Document No, or Survey No',
        'status.verified': 'Verified',
        'status.pending': 'Pending',
        'label.docNo': 'Document Number',
        'label.owner': 'Owner Name',
        'label.survey': 'Survey Number',
        'label.category': 'Category',
        'label.location': 'Physical Location',
    },
    ta: {
        'app.title': 'தமிழ்நாடு நில பதிவு',
        'nav.staff': 'பணியாளர் தளம்',
        'nav.public': 'பொது தேடல்',
        'hero.title': 'டிஜிட்டல் நில ஆவண அமைப்பு',
        'hero.subtitle': 'தமிழ்நாட்டிற்கான வெளிப்படையான, பாதுகாப்பான மற்றும் அணுகக்கூடிய நில ஆவணங்கள்',
        'btn.login': 'பணியாளர் உள்நுழைவு',
        'btn.search': 'ஆவணங்களைத் தேடுங்கள்',
        'upload.title': 'ஆவணங்களை பதிவேற்றவும்',
        'upload.desc': 'ஸ்கேன் செய்யப்பட்ட நில ஆவணங்களை இங்கே இழுத்து விடவும்',
        'search.placeholder': 'உரிமையாளர் பெயர், ஆவண எண் அல்லது சர்வே எண்ணை உள்ளிடவும்',
        'status.verified': 'சரிபார்க்கப்பட்டது',
        'status.pending': 'நிலுவையில் உள்ளது',
        'label.docNo': 'ஆவண எண்',
        'label.owner': 'உரிமையாளர் பெயர்',
        'label.survey': 'சர்வே எண்',
        'label.category': 'வகை',
        'label.location': 'இருப்பிடம்',
    }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>('en');

    const t = (key: string) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
