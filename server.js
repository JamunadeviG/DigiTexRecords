import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

// Memory storage
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_secure_12345';

// --- MongoDB Models ---

// User Schema
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, enum: ['staff', 'public'], default: 'public' },
    officeDetails: {
        officeName: String,
        officeCode: String,
        district: String,
        taluk: String,
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Document Schema
const documentSchema = new mongoose.Schema({
    documentType: { type: String, default: 'Unknown' },
    registrationNumber: String,
    registrationDate: String,
    sellerName: String, // Party 1
    buyerName: String,  // Party 2

    // Property Details
    surveyNumber: String,
    village: String,
    taluk: String,
    district: String,
    propertyDetails: Object,

    considerationAmount: String,
    fullText: String,
    extractedText: String,

    fileName: String,
    uploadedAt: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isVerified: { type: Boolean, default: false }
});

// Text Index for Search
documentSchema.index({
    fullText: 'text',
    extractedText: 'text',
    surveyNumber: 'text',
    village: 'text',
    docNumber: 'text',
    ownerName: 'text' // Add ownerName strictly if previously missed
});

const Document = mongoose.model('Document', documentSchema);

// --- Middleware ---

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        req.user = decoded;
        next();
    });
};

const verifyStaff = (req, res, next) => {
    if (req.user && (req.user.role === 'staff' || req.user.role === 'admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Access Denied: Staff only' });
    }
};

// --- Python OCR Integration ---
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Routes ---

// 1. Public Signup (Forces role='public')
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            phone,
            role: 'public', // Enforced
            officeDetails: null // Public users don't have office details
        });

        await newUser.save();

        const token = jwt.sign(
            { id: newUser._id, role: newUser.role, email: newUser.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                role: newUser.role
            },
            token
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Sign In
app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Fallback for existing plain text users (Migration HACK)
            if (user.password === password) {
                // Ideally we should hash it now and save, but let's just warn
                console.warn(`User ${email} has legacy plain password.`);
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                officeDetails: user.officeDetails
            },
            token
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Admin/Staff Create Staff (Protected)
app.post('/api/admin/create-staff', verifyToken, verifyStaff, async (req, res) => {
    try {
        const { fullName, email, password, phone, officeDetails } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            phone,
            role: 'staff', // Explicitly Staff
            officeDetails
        });

        await newUser.save();

        console.log(`[Admin] Staff created: ${email} by ${req.user.email}`);

        res.status(201).json({ message: 'Staff account created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Preprocessing Endpoint (Staff Only)
app.post('/api/ocr/preprocess', verifyToken, verifyStaff, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const tempFilePath = path.join(__dirname, `temp_pre_${Date.now()}_${req.file.originalname}`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        const pythonProcess = spawn('python', ['ocr_engine.py', tempFilePath, '--mode', 'preprocess']);

        let output = '';
        pythonProcess.stdout.on('data', (data) => output += data.toString());

        pythonProcess.on('close', (code) => {
            fs.unlink(tempFilePath, () => { }); // Cleanup input

            if (code !== 0) {
                return res.status(500).json({ error: 'Preprocessing failed' });
            }

            try {
                const result = JSON.parse(output);
                if (result.status === 'success' && result.processed_path) {
                    // Read processed file
                    const processedBuffer = fs.readFileSync(result.processed_path);
                    const base64Image = `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;

                    // Cleanup processed file
                    fs.unlink(result.processed_path, () => { });

                    res.json({
                        success: true,
                        processedImage: base64Image,
                        message: "Preprocessing successful"
                    });
                } else {
                    res.status(500).json({ error: result.message || 'Unknown error' });
                }
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse engine output' });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Recognition Endpoint (OCR Only - Staff Only)
app.post('/api/ocr/recognize', verifyToken, verifyStaff, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const tempFilePath = path.join(__dirname, `temp_ocr_${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        const pythonProcess = spawn('python', ['ocr_engine.py', tempFilePath, '--mode', 'ocr']);

        let output = '';
        pythonProcess.stdout.on('data', (data) => output += data.toString());

        pythonProcess.on('close', async (code) => {
            fs.unlink(tempFilePath, () => { });

            if (code !== 0) return res.status(500).json({ error: 'OCR failed' });

            try {
                const result = JSON.parse(output);
                if (result.status === 'success') {
                    // Extract structured data (similar to legacy)
                    const fullText = result.full_text;
                    const structuredData = {
                        docNumber: (fullText.match(/எண்[:\s-]*(\d+\/\d+)/) || [])[1] || "",
                        date: (fullText.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/) || [])[0] || "",
                        surveyNumber: (fullText.match(/Survey No\.?\s*(\d+\/?\w*)/i) || [])[1] || "",
                        category: (fullText.match(/கிரைய பத்திரம்|Sale Deed|Lease|Mortgage/i) || [])[0] || "Sale Deed",
                        fullText: fullText,
                        blocks: result.blocks
                    };

                    // Save to DB
                    const newDoc = new Document({
                        fileName: req.file.originalname,
                        docNumber: structuredData.docNumber,
                        category: structuredData.category,
                        extractedText: fullText,
                        uploadedAt: new Date(),
                        userId: req.user.id // Use authenticated User ID
                    });
                    await newDoc.save();

                    res.json({
                        success: true,
                        text: fullText,
                        structuredData,
                        confidence: result.confidence
                    });
                } else {
                    res.status(500).json({ error: result.message });
                }
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse OCR output' });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy/Combined Endpoint
app.post('/api/ocr/process', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`[OCR] Processing ${req.file.originalname} with Python (ocr_tamil)...`);

        // 1. Save buffer to temp file
        const tempFilePath = path.join(__dirname, `temp_upload_${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, req.file.buffer);

        // 2. Spawn Python process
        const pythonProcess = spawn('python', ['ocr_engine.py', tempFilePath]); // Default mode

        let ocrResult = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            ocrResult += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            // Optional: Log stderr but don't fail immediately as some libs print warnings to stderr
            console.warn(`[Python Stderr]: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            // Clean up temp file
            fs.unlink(tempFilePath, (err) => {
                if (err) console.error("Error deleting temp file:", err);
            });

            if (code !== 0) {
                console.error(`[OCR] Python process exited with code ${code}`);
                return res.status(500).json({
                    error: 'OCR Process Failed',
                    details: errorOutput || 'Unknown python error'
                });
            }

            console.log("[OCR] Python finished processing");

            try {
                // Parse JSON output from EasyOCR script
                let result;
                try {
                    result = JSON.parse(ocrResult);
                } catch (e) {
                    console.error("JSON Parse Error:", ocrResult);
                    throw new Error("Invalid output from OCR engine");
                }

                if (result.status === 'error') {
                    return res.status(500).json({ error: result.message });
                }

                const fullText = result.full_text || "";

                // Structured Data Extraction (Regex Fallback)
                const structuredData = {
                    docNumber: (fullText.match(/எண்[:\s-]*(\d+\/\d+)/) || [])[1] || "",
                    date: (fullText.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/) || [])[0] || "",
                    surveyNumber: (fullText.match(/Survey No\.?\s*(\d+\/?\w*)/i) || [])[1] || "",
                    category: (fullText.match(/கிரைய பத்திரம்|Sale Deed|Lease|Mortgage/i) || [])[0] || "Sale Deed",
                    fullText: fullText,
                    blocks: result.blocks // Return detailed blocks with confidence
                };

                // Save to DB
                const newDoc = new Document({
                    fileName: req.file.originalname,
                    docNumber: structuredData.docNumber,
                    category: structuredData.category,
                    ownerName: "", // Placeholder
                    extractedText: fullText,
                    uploadedAt: new Date(),
                    userId: req.body.userId || null
                });

                await newDoc.save();
                console.log(`[DB] Saved Document: ${newDoc._id}`);

                res.json({
                    success: true,
                    text: fullText,
                    structuredData: structuredData,
                    confidence: result.blocks && result.blocks.length > 0 ? result.blocks[0].confidence : 0,
                    data: newDoc
                });

            } catch (err) {
                console.error("Processing Error:", err);
                return res.status(500).json({ error: "Failed to process OCR results", details: err.message });
            }
        });

    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({
            error: "OCR Processing Failed",
            details: err.message,
            hint: "Check server logs"
        });
    }
});

// Get Documents
app.get('/api/documents', async (req, res) => {
    const docs = await Document.find().sort({ uploadedAt: -1 });
    res.json(docs);
});

// --- Public Search Endpoint ---
app.get('/api/public/search', async (req, res) => {
    try {
        const { q, survey, owner, docType, year, place, from, to } = req.query;

        let query = {};

        // Text Search (High Priority)
        if (q) {
            query.$text = { $search: q };
        }

        // Filters
        if (survey) query.surveyNumber = { $regex: survey, $options: 'i' };
        // ownerName is inside propertyDetails or passed as separate field? 
        // Schema has `sellerName`, `buyerName`. Let's search both for "owner".
        if (owner) {
            query.$or = [
                { sellerName: { $regex: owner, $options: 'i' } },
                { buyerName: { $regex: owner, $options: 'i' } }
            ];
        }

        if (docType) query.documentType = docType;

        if (place) {
            query.$or = [
                { village: { $regex: place, $options: 'i' } },
                { taluk: { $regex: place, $options: 'i' } },
                { district: { $regex: place, $options: 'i' } }
            ];
        }

        // Date Range Filter (Basic implementation assuming YYYY format or regex)
        // Ideally we should parse registrationDate. For now, strict year string match
        if (year) {
            query.registrationDate = { $regex: year, $options: 'i' };
        }

        const results = await Document.find(query)
            .sort({ registrationDate: 1, uploadedAt: -1 }) // Chronological for chain
            .limit(100);

        res.json({
            count: results.length,
            results: results
        });

    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).json({ error: "Search failed", details: err.message });
    }
});

// Connect DB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
        app.listen(5000, () => console.log("🚀 Server running on port 5000"));
    })
    .catch(err => console.error("❌ MongoDB Error:", err));
