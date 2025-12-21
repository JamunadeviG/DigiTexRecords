require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Models ---

// User Schema
const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    role: { type: String, enum: ['staff', 'public'], default: 'public' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Document Schema
const documentSchema = new mongoose.Schema({
    docNumber: { type: String, required: true }, // e.g., DOC-2023-001
    ownerName: { type: String, required: true },
    previousOwnerName: String,
    surveyNumber: String,
    location: String, // Constructed from District/Taluk/Village
    category: { type: String, enum: ['Sale Deed', 'Patta', 'Chitta', 'Adangal', 'FMB', 'Other'] },
    date: Date,

    // Storage & Access
    originalFileUrl: String, // Path or Blob URL reference
    preprocessedFileUrl: String,

    // OCR & Integrity
    ocrData: {
        text: String,
        confidence: Number,
        fields: Object // Flexible JSON for extracted fields
    },
    // Auto-Categorization
    categoryConfidence: Number,
    categoryKeywords: [String],

    isVerified: { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
});

// Text Indexes for Search
documentSchema.index({ ownerName: 'text', location: 'text', 'ocrData.text': 'text' });

const Document = mongoose.model('Document', documentSchema);

// --- Database Connection ---

const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("✅ MongoDB Connected Successfully");

        // Initial Test Query
        const count = await Document.countDocuments();
        console.log(`Initial Document Count: ${count}`);

    } catch (err) {
        console.error(`❌ MongoDB Connection Failed: ${err.message}`);
        if (retries > 0) {
            console.log(`Typing to reconnect in 5 seconds... (${retries} attempts left)`);
            setTimeout(() => connectDB(retries - 1), 5000);
        } else {
            process.exit(1);
        }
    }
};

mongoose.connection.on('connected', () => console.log('Mongoose connected to DB'));
mongoose.connection.on('error', (err) => console.log('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

// --- API Routes ---

// Health Check
app.get('/api/health', (req, res) => res.send('API Running'));

// Create Document
app.post('/api/documents', async (req, res) => {
    try {
        const doc = await Document.create(req.body);
        res.status(201).json(doc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Documents (Search)
app.get('/api/documents', async (req, res) => {
    try {
        const { query } = req.query;
        let searchCriteria = {};

        if (query) {
            searchCriteria = { $text: { $search: query } };
        }

        const docs = await Document.find(searchCriteria).sort({ timestamp: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Document Chain (Simplified)
app.get('/api/documents/:id/chain', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Document not found" });

        // Simple chain logic: Find by previous owner name
        // In real backend, this would be a recursive graph lookup
        const prevDoc = await Document.findOne({ ownerName: doc.previousOwnerName });

        const chain = [doc];
        if (prevDoc) chain.unshift(prevDoc);

        res.json(chain);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Server Startup ---

connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
