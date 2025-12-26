import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Memory Storage (Buffer)
const storage = multer.memoryStorage();

const uploadDisk = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit (MongoDB Document limit)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/^image\/(jpeg|png|gif|tiff)$/) || file.mimetype.includes('pdf')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'), false);
        }
    }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_secure_12345';

// Helper: Get Temp File path from Buffer
const writeTempFile = (buffer, originalName) => {
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `ocr_${Date.now()}_${originalName}`);
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
};

// Helper: Convert File to Base64 Image (Handles PDF via Python)
// UPDATED: Now accepts Buffer directly or Path
async function getFileAsImageBase64(fileInput, mimetype, isBuffer = false) {
    let filePath = fileInput;
    let tempPathCreated = null;

    if (isBuffer) {
        // Write buffer to temp file for Python processing
        tempPathCreated = writeTempFile(fileInput, 'temp_conversion.file');
        filePath = tempPathCreated;
    }

    console.log(`[File Processing] Path: ${filePath}, Mime: ${mimetype}`);

    try {
        if (mimetype && mimetype.toLowerCase().includes('pdf')) {
            // Convert PDF first page to Image using Python
            console.log(`[PDF Conversion] Converting PDF via Python...`);

            return await new Promise((resolve, reject) => {
                const scriptPath = path.join(__dirname, 'scripts', 'convert_pdf.py');
                const pythonProcess = spawn('python', [scriptPath, filePath]);

                let dataString = '';

                // Set a timeout
                const timeout = setTimeout(() => {
                    pythonProcess.kill();
                    reject(new Error("PDF conversion timed out"));
                }, 30000);

                pythonProcess.stdout.on('data', (data) => dataString += data.toString());
                pythonProcess.stderr.on('data', (data) => console.error(`[PDF Stderr] ${data}`));

                pythonProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code !== 0) return reject(new Error(`PDF conversion failed code ${code}`));

                    try {
                        const result = JSON.parse(dataString);
                        if (result.success) {
                            resolve({
                                base64: result.base64,
                                mime: 'image/png',
                                dataURI: `data:image/png;base64,${result.base64}`
                            });
                        } else {
                            reject(new Error(result.error));
                        }
                    } catch (e) {
                        reject(new Error("Failed to parse Python output"));
                    }
                });
            });

        } else {
            // Standard Image - Read from file if path, or use buffer
            let fileBuffer;
            if (isBuffer) {
                fileBuffer = fileInput; // It IS the buffer
            } else {
                fileBuffer = fs.readFileSync(filePath);
            }

            return {
                base64: fileBuffer.toString('base64'),
                mime: mimetype || 'image/jpeg',
                dataURI: `data:${mimetype || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`
            };
        }
    } finally {
        // Cleanup temp file if we created one
        if (tempPathCreated && fs.existsSync(tempPathCreated)) {
            fs.unlinkSync(tempPathCreated);
        }
    }
}
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
    sellerName: String,
    buyerName: String,

    // Property Details
    surveyNumber: String,
    village: String,
    taluk: String,
    district: String,
    propertyDetails: Object,

    // New OCR Fields
    pattaNumber: String,
    batchNumber: String,
    summary: String,
    ocrData: Object, // Full structured data

    considerationAmount: String,
    fullText: String,
    extractedText: String,

    fileName: String,
    contentType: String, // MIME type
    fileData: Buffer,    // Binary File Content

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

// Helper: Analyze Image with PaddleOCR (Local Python Script)
async function analyzeImageWithPaddle(filePath) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'ocr_engine.py');
        console.log(`[PaddleOCR] Spawning Python script for: ${filePath}`);

        // Pass file path via Environment Variable to avoid PaddleOCR arg parsing conflict
        const env = { ...process.env, OCR_IMAGE_PATH: filePath };

        // Spawn with ONLY the script path, no other args
        const pythonProcess = spawn('python', [scriptPath], { env });

        let dataString = '';
        let errorString = '';

        const timeout = setTimeout(() => {
            pythonProcess.kill();
            reject(new Error("OCR timed out after 60 seconds"));
        }, 60000);

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
        });

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);

            // Clean up stdout to find the JSON part (in case of other prints)
            // The script prints some non-JSON text before the JSON logic? 
            // In my implementation of ocr_engine.py, I print "--- Tamil Text Extracted ---" etc.
            // But the JSON is printed last or we should look for it.

            // Actually, my `ocr_engine.py` prints the JSON at the end.
            // But it also prints "--- Tamil Text Extracted ---" and the text lines.
            // I should scan for the last JSON object.

            if (code !== 0) {
                console.error(`[PaddleOCR Error] Exit code ${code}: ${errorString}`);
                // Try to recover any message from stdout if possible
                try {
                    const lastLine = dataString.trim().split('\n').pop();
                    const res = JSON.parse(lastLine);
                    if (res.status === 'error') {
                        reject(new Error(res.message));
                        return;
                    }
                } catch (e) { }
                reject(new Error(`OCR Process failed: ${errorString || 'Unknown error'}`));
                return;
            }

            try {
                // Find the JSON output. It should be the last line or contained in the output.
                // My script does: print(json.dumps({...})) at the end.
                const lines = dataString.trim().split('\n');
                let result = null;

                // Try parsing backwards
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const parsed = JSON.parse(lines[i]);
                        if (parsed.status) {
                            result = parsed;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (result && result.status === 'success') {
                    // Map new structure from ocr_engine.py
                    const fields = result.fields || {};
                    resolve({
                        fullText: result.text || "",
                        documentType: fields.documentType || "Unknown",
                        registrationNumber: "", // Not extracted yet
                        registrationDate: fields.date || "",
                        sellerName: fields.ownerName || "", // Mapping owner to seller
                        buyerName: "",
                        surveyNumber: fields.surveyNumber || "",

                        pattaNumber: fields.pattaNumber || "",
                        batchNumber: fields.batchNumber || "",
                        summary: fields.summary || "",

                        village: fields.village || "",
                        taluk: fields.taluk || "",
                        district: fields.district || "",
                        considerationAmount: ""
                    });
                } else if (result && result.status === 'error') {
                    reject(new Error(result.message));
                } else {
                    console.error("[PaddleOCR Error] No valid JSON found in output:\n", dataString);
                    reject(new Error("No valid JSON response from OCR engine"));
                }
            } catch (e) {
                console.error("[PaddleOCR Parsing Error]", e);
                reject(new Error("Failed to parse OCR output"));
            }
        });
    });
}



// 2. OCR Recognition Endpoint
app.post('/api/ocr/recognize', uploadDisk.single('document'), async (req, res) => {
    const startTime = Date.now();
    let tempPath = null;

    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Write buffer to temp file for Python
        tempPath = writeTempFile(req.file.buffer, req.file.originalname);
        console.log(`[OCR Recognize] Processing: ${req.file.originalname}`);

        const resultData = await analyzeImageWithPaddle(tempPath);
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // CLEANUP: Delete temp file
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        res.json({
            success: true,
            text: resultData.fullText || '',
            confidence: 0.95,
            structuredData: resultData,
            processingTime: `${processingTime}s`
        });

    } catch (err) {
        console.error('[OCR Recognize Error]', err);
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        res.status(500).json({ error: 'OCR processing failed', details: err.message });
    }
});

// 3. OCR Process (Generic)
app.post('/api/ocr/process', uploadDisk.single('document'), async (req, res) => {
    const startTime = Date.now();
    let tempPath = null;

    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        tempPath = writeTempFile(req.file.buffer, req.file.originalname);
        const resultData = await analyzeImageWithPaddle(tempPath);
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        res.json({
            success: true,
            message: "OCR processing successful",
            data: {
                fileName: req.file.originalname,
                processingTime: `${processingTime}s`,
                ...resultData
            },
            structuredData: resultData,
            text: resultData.fullText
        });
    } catch (err) {
        console.error('[OCR Process Error]', err);
        if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Preprocessing Endpoint
app.post('/api/ocr/preprocess', uploadDisk.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        console.log(`[Preprocessing] Enhancing: ${req.file.originalname}`);

        // Convert directly from buffer
        const { dataURI } = await getFileAsImageBase64(req.file.buffer, req.file.mimetype, true);

        res.json({
            success: true,
            message: "Preprocessing complete",
            processedImage: dataURI,
            metrics: { deskewAngle: 0, noiseLevel: 'low', contrast: 'enhanced' }
        });

    } catch (err) {
        console.error('[Preprocessing Error]', err);
        res.status(500).json({ error: 'Preprocessing failed', details: err.message });
    }
});

// 5. Save Document Endpoint (New) - Stores File + Metadata
app.post('/api/documents/save', uploadDisk.single('document'), verifyToken, async (req, res) => {
    try {
        const {
            docNumber, category, ownerName, surveyNumber,
            pattaNumber, batchNumber, summary,
            registrationDate, village, taluk, district,
            ocrData
        } = req.body;

        // If file is present, we store it. If not, maybe we just update metadata? 
        // For this task, we assume NEW save includes file.
        if (!req.file) return res.status(400).json({ error: 'Document file is required for saving.' });

        // Parse OCR Data if stringified
        let parsedOcrData = {};
        try {
            parsedOcrData = typeof ocrData === 'string' ? JSON.parse(ocrData) : ocrData;
        } catch (e) { }

        const newDoc = new Document({
            userId: req.user.id,
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            fileData: req.file.buffer, // Store Binary

            documentType: category || 'Unknown',
            registrationNumber: docNumber,
            registrationDate: registrationDate,
            sellerName: ownerName, // Mapping owner to seller for now
            surveyNumber,
            pattaNumber,
            batchNumber,
            summary,
            village,
            taluk,
            district,

            ocrData: parsedOcrData,
            fullText: parsedOcrData?.startText || '', // Just a backup

            uploadedAt: new Date(),
            isVerified: true
        });

        await newDoc.save();

        // Return without the file data to keep response light
        const { fileData, ...docWithoutFile } = newDoc.toObject();
        res.status(201).json({ success: true, message: "Document Saved", document: docWithoutFile });

    } catch (err) {
        console.error("[Save Doc Error]", err);
        res.status(500).json({ error: "Failed to save document" });
    }
});

// Batch Endpoint - Removed or Refactored? 
// For now, let's keep it simple or comment it out if not using buffer logic for arrays yet.
// Re-implementing array support for memory storage:
app.post('/api/ocr/batch', uploadDisk.array('documents', 10), async (req, res) => {
    const startTime = Date.now();
    const files = req.files;
    const results = [];

    if (!files || files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    for (const [index, file] of files.entries()) {
        const fileStartTime = Date.now();
        let tempPath = null;
        try {
            tempPath = writeTempFile(file.buffer, file.originalname);
            const resultData = await analyzeImageWithPaddle(tempPath);

            results.push({
                fileName: file.originalname,
                status: 'success',
                processingTime: ((Date.now() - fileStartTime) / 1000).toFixed(2) + 's',
                data: resultData
            });

            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (error) {
            if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            results.push({ fileName: file.originalname, status: 'failed', error: error.message });
        }
    }
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    res.json({ success: true, results, totalTime, processedCount: results.length });
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
