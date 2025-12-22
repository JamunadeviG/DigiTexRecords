import { createWorker, type Worker, PSM, OEM } from 'tesseract.js';

interface QueueItem {
    id: string;
    image: string; // Base64 or Blob URL
    resolve: (result: any) => void;
    reject: (error: any) => void;
    options?: any;
}

export class OcrWorkerPool {
    private workers: Worker[] = [];
    private queue: QueueItem[] = [];
    private activeWorkers: boolean[] = []; // true if busy
    private poolSize: number;
    private isInitialized: boolean = false;

    constructor(size: number = 4) {
        this.poolSize = size;
        this.activeWorkers = new Array(size).fill(false);
    }

    async init() {
        if (this.isInitialized) return;

        console.log(`Initializing OCR Worker Pool with ${this.poolSize} workers...`);
        const initPromises = [];

        for (let i = 0; i < this.poolSize; i++) {
            initPromises.push((async () => {
                const worker = await createWorker('tam+eng');
                await worker.setParameters({
                    tessedit_pageseg_mode: PSM.AUTO_OSD, // PSM '1'
                    tessedit_ocr_engine_mode: OEM.LSTM_ONLY, // OEM '1'
                });
                return worker;
            })());
        }

        this.workers = await Promise.all(initPromises);
        this.isInitialized = true;
        console.log('OCR Worker Pool Ready');
    }

    async process(image: string, options: any = {}): Promise<any> {
        if (!this.isInitialized) await this.init();

        return new Promise((resolve, reject) => {
            const id = Math.random().toString(36).substring(7);
            this.queue.push({ id, image, resolve, reject, options });
            this.processNext();
        });
    }

    private async processNext() {
        // Find idle worker
        const workerIndex = this.activeWorkers.findIndex(busy => !busy);
        if (workerIndex === -1 || this.queue.length === 0) return;

        // Claim worker
        this.activeWorkers[workerIndex] = true;
        const job = this.queue.shift();

        if (!job) {
            this.activeWorkers[workerIndex] = false;
            return;
        }

        const worker = this.workers[workerIndex];

        try {
            // Configure specific params if needed per job, or assume global default
            if (job.options.isHandwritten) {
                await worker.setParameters({
                    tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // PSM '6'
                });
            } else {
                await worker.setParameters({
                    tessedit_pageseg_mode: PSM.AUTO, // PSM '3'
                });
            }

            const result = await worker.recognize(job.image);
            job.resolve(result);
        } catch (error) {
            job.reject(error);
        } finally {
            this.activeWorkers[workerIndex] = false;
            this.processNext(); // Check for more work
        }
    }

    async terminate() {
        await Promise.all(this.workers.map(w => w.terminate()));
        this.workers = [];
        this.isInitialized = false;
    }
}

export const workerPool = new OcrWorkerPool(4); // Export singleton
