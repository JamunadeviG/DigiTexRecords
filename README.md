# DigiTexRecords - Land Registry System

## Prerequisites
- Node.js (v16+)
- Python (v3.8+)
- MongoDB (Running locally or via connection string)

## Installation

1. Install Node dependencies:
   ```bash
   npm install
   ```

2. Install Python dependencies (for OCR):
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

You need to run the **Backend** and **Frontend** in separate terminals.

### 1. Backend Server
Runs on http://localhost:5000
```bash
npm run start:api
```

### 2. Frontend Application
Runs on http://localhost:5173
```bash
npm run dev
```

## Features
- Document Upload & OCR (PaddleOCR)
- Land Registry Management
- Search & Retrieval

---
# React + TypeScript + Vite (Original Readme)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
...
