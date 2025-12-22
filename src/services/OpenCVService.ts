

// Define minimal types for OpenCV.js integration
declare global {
    interface Window {
        cv: any;
        Module: any;
    }
}

export const OPEN_CV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

class OpenCVService {
    private static instance: OpenCVService;
    private isLoaded: boolean = false;
    private isLoading: boolean = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() { }

    public static getInstance(): OpenCVService {
        if (!OpenCVService.instance) {
            OpenCVService.instance = new OpenCVService();
        }
        return OpenCVService.instance;
    }

    public async loadOpenCV(): Promise<void> {
        if (this.isLoaded) return Promise.resolve();
        if (this.isLoading && this.loadPromise) return this.loadPromise;

        this.isLoading = true;
        this.loadPromise = new Promise<void>((resolve, reject) => {
            if (window.cv && window.cv.Mat) {
                this.isLoaded = true;
                this.isLoading = false;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = OPEN_CV_URL;
            script.async = true;
            script.type = 'text/javascript';

            script.onload = () => {
                // OpenCV.js takes a moment to initialize Wasm after script load
                if (window.cv.getBuildInformation) {
                    this.isLoaded = true;
                    this.isLoading = false;
                    console.log("OpenCV.js loaded successfully");
                    resolve();
                } else {
                    // If cv is defined but not ready (older versions or specific build), wait for runtime init
                    window.Module = {
                        onRuntimeInitialized: () => {
                            this.isLoaded = true;
                            this.isLoading = false;
                            console.log("OpenCV.js runtime initialized");
                            resolve();
                        }
                    };
                }
            };

            script.onerror = () => {
                this.isLoading = false;
                reject(new Error('Failed to load OpenCV.js'));
            };

            document.body.appendChild(script);
        });

        return this.loadPromise;
    }

    public get cv(): any {
        if (!this.isLoaded) {
            throw new Error('OpenCV is not loaded. Call loadOpenCV() first.');
        }
        return window.cv;
    }

    public isReady(): boolean {
        return this.isLoaded;
    }
}

export const openCVService = OpenCVService.getInstance();
