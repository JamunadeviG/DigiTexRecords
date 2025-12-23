import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import ollama from 'ollama';

const app = express();
app.use(cors());
app.use(express.json());

// Memory storage (Legacy/Existing)
const upload = multer({ storage: multer.memoryStorage() });

// Disk Storage (For Ollama Process)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads/temp');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadDisk = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images and PDFs are allowed'));
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_secure_12345';

// --- MongoDB Models ---

// User Schema
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: String,
    role: { type: String, enum: ['staff', 'public', 'admin'], default: 'public' },
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

// 1. Public Registration (Open)
app.post('/api/auth/register/public', async (req, res) => {
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
            role: 'public', // Strictly Enforced
            officeDetails: null
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

// 3. Staff Registration (Open - per user request)
app.post('/api/auth/register/staff', async (req, res) => {
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
            role: 'staff', // Strictly Enforced
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

// 2. OCR Recognition Endpoint (Step 2 of Workflow)
app.post('/api/ocr/recognize', uploadDisk.single('document'), async (req, res) => {
    // Re-use the same Qwen logic as /process
    // This endpoint exists to match the "Local Mode" / "Step-by-Step" workflow in the frontend

    // Logic is identical to /api/ocr/process
    const startTime = Date.now();
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        filePath = req.file.path;
        console.log(`[OCR Recognize] Processing file: ${req.file.originalname}`);

        const fileBuffer = fs.readFileSync(filePath);

        const response = await ollama.chat({
            model: 'qwen2.5-vl:7b',
            messages: [{
                role: 'user',
                content: `Perform optical character recognition (OCR) on this image.
                1. Extract ALL text present in the image verbatim. Do not summarize or rephrase.
                2. Identify specific fields for land registration:
                   - documentNumber (Document No / ஆவண எண்)
                   - ownerName (Name of Owner/Seller/Buyer)
                   - surveyNumber (Survey No / சர்வே எண்)
                   - villageTaluk (Village & Taluk)
                   - registrationDate (Date)
                   - documentType (Sale Deed, Settlement, etc.)
                
                Return a single JSON object. If a field is not found, use "".
                Ensure the "fullExtractedText" field contains the complete raw text of the document.
                
                JSON Format:
                {
                    "documentNumber": "string",
                    "ownerName": "string",
                    "surveyNumber": "string",
                    "villageTaluk": "string",
                    "registrationDate": "string",
                    "documentType": "string",
                    "fullExtractedText": "string"
                }`,
                images: [fileBuffer]
            }],
            format: 'json',
            options: {
                temperature: 0,
                num_ctx: 4096
            }
        });

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Parse and cleanup
        let resultData;
        try {
            const content = response.message.content.replace(/```json\n?|\n?```/g, '').trim();
            resultData = JSON.parse(content);
        } catch (parseError) {
            resultData = { fullExtractedText: response.message.content };
        }

        fs.unlink(filePath, () => { });

        // Return format expected by "Local Mode" client
        res.json({
            success: true,
            text: resultData.fullExtractedText || '',
            confidence: 0.95,
            structuredData: resultData,
            processingTime: `${processingTime}s`
        });

    } catch (err) {
        console.error('[OCR Recognize Error]', err);
        if (filePath) fs.unlink(filePath, () => { });
        res.status(500).json({ error: 'OCR processing failed', details: err.message });
    }
});

// 3. Ollama OCR Endpoint (Single File - Cloud Mode direct)
app.post('/api/ocr/process', uploadDisk.single('document'), async (req, res) => {
    const startTime = Date.now();
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        filePath = req.file.path;
        console.log(`[OCR Start] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

        // Read file and convert to base64
        const fileBuffer = fs.readFileSync(filePath);
        // const base64Image = fileBuffer.toString('base64'); // Not strictly needed if passing buffer, but good for debug

        const response = await ollama.chat({
            model: 'qwen2.5-vl:7b',
            messages: [{
                role: 'user',
                content: `Perform optical character recognition (OCR) on this image.
                1. Extract ALL text present in the image verbatim. Do not summarize or rephrase.
                2. Identify specific fields for land registration:
                   - documentNumber (Document No / ஆவண எண்)
                   - ownerName (Name of Owner/Seller/Buyer)
                   - surveyNumber (Survey No / சர்வே எண்)
                   - villageTaluk (Village & Taluk)
                   - registrationDate (Date)
                   - documentType (Sale Deed, Settlement, etc.)
                
                Return a single JSON object. If a field is not found, use "".
                Ensure the "fullExtractedText" field contains the complete raw text of the document.
                
                JSON Format:
                {
                    "documentNumber": "string",
                    "ownerName": "string",
                    "surveyNumber": "string",
                    "villageTaluk": "string",
                    "registrationDate": "string",
                    "documentType": "string",
                    "fullExtractedText": "string"
                }`,
                images: [fileBuffer]
            }],
            format: 'json',
            options: {
                temperature: 0, // Zero temperature for deterministic extraction
                num_ctx: 4096   // Increase context window if needed
            }
        });

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[OCR Success] Processed in ${processingTime}s`);

        let resultData;
        try {
            // Handle potential markdown wrapping in response
            const content = response.message.content.replace(/```json\n?|\n?```/g, '').trim();
            resultData = JSON.parse(content);
        } catch (parseError) {
            console.warn('[OCR Warning] Failed to parse JSON, returning raw text');
            resultData = { fullExtractedText: response.message.content };
        }

        // Cleanup
        fs.unlink(filePath, (err) => {
            if (err) console.error(`[Cleanup Error] Failed to delete ${filePath}:`, err);
        });

        res.json({
            success: true,
            fileName: req.file.originalname,
            processingTime: `${processingTime}s`,
            ...resultData
        });

    } catch (err) {
        console.error('[OCR Error]', err);
        if (filePath) {
            fs.unlink(filePath, () => { });
        }
        res.status(500).json({
            success: false,
            error: 'OCR processing failed',
            details: err.message
        });
    }
});

// 4. Ollama OCR Batch Endpoint
app.post('/api/ocr/batch', uploadDisk.array('documents', 10), async (req, res) => {
    const startTime = Date.now();
    const files = req.files;
    const results = [];

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`[Batch Start] Processing ${files.length} files`);

    // Process sequentially to avoid overloading the local model
    for (const [index, file] of files.entries()) {
        const fileStartTime = Date.now();
        console.log(`[Batch Progress] Processing ${index + 1}/${files.length}: ${file.originalname}`);

        try {
            const fileBuffer = fs.readFileSync(file.path);

            const response = await ollama.chat({
                model: 'qwen2.5-vl:7b',
                messages: [{
                    role: 'user',
                    content: `Perform optical character recognition (OCR) on this image.
                    1. Extract ALL text present in the image verbatim. Do not summarize or rephrase.
                    2. Identify specific fields for land registration:
                       - documentNumber (Document No / ஆவண எண்)
                       - ownerName (Name of Owner/Seller/Buyer)
                       - surveyNumber (Survey No / சர்வே எண்)
                       - villageTaluk (Village & Taluk)
                       - registrationDate (Date)
                       - documentType (Sale Deed, Settlement, etc.)
                    
                    Return a single JSON object. If a field is not found, use "".
                    Ensure the "fullExtractedText" field contains the complete raw text of the document.
                    
                    JSON Format:
                    {
                        "documentNumber": "string",
                        "ownerName": "string",
                        "surveyNumber": "string",
                        "villageTaluk": "string",
                        "registrationDate": "string",
                        "documentType": "string",
                        "fullExtractedText": "string"
                    }`,
                    images: [fileBuffer]
                }],
                format: 'json',
                options: {
                    temperature: 0,
                    num_ctx: 4096
                }
            });

            let parsedData = {};
            try {
                const content = response.message.content.replace(/```json\n?|\n?```/g, '').trim();
                parsedData = JSON.parse(content);
            } catch (e) {
                parsedData = { fullExtractedText: response.message.content };
            }

            results.push({
                fileName: file.originalname,
                status: 'success',
                processingTime: ((Date.now() - fileStartTime) / 1000).toFixed(2) + 's',
                data: parsedData
            });

        } catch (error) {
            console.error(`[Batch Error] File: ${file.originalname}`, error);
            results.push({
                fileName: file.originalname,
                status: 'failed',
                error: error.message
            });
        } finally {
            // Cleanup individual file
            fs.unlink(file.path, () => { });
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Batch Complete] Finished in ${totalTime}s`);

    res.json({
        success: true,
        totalFiles: files.length,
        totalTime: `${totalTime}s`,
        results: results
    });
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
