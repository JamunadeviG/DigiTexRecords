import { openCVService } from './OpenCVService';
import { fastPreprocessing } from './fastPreprocessing';

export interface ImageProcessingOptions {
    grayscale: boolean;
    contrast: number; // -100 to 100
    brightness: number; // -100 to 100
    threshold: number; // 0 to 255, -1 for disabled
    denoise: boolean;
    deskew?: boolean;
    removeBorders?: boolean;
    detectTable?: boolean;
    fastMode?: boolean; // New flag
    returnSteps?: boolean;
}

export interface TableStructure {
    rows: number;
    cols: number;
    cells: CellData[];
    gridImage?: string; // Data URL of image with grid overlay
}

export interface CellData {
    id: number;
    row: number;
    col: number;
    x: number;
    y: number;
    width: number;
    height: number;
    imageData: string; // Base64 of the individual cell

    // OCR Results
    text?: string;
    confidence?: number;
    needsReview?: boolean;
}

export const processImage = async (file: File, options: ImageProcessingOptions): Promise<{ processedImage: string; tableData?: TableStructure, steps?: any[], metrics?: any }> => {
    // Ensure OpenCV is loaded
    await openCVService.loadOpenCV();
    const cv = openCVService.cv;

    // FAST MODE PATH
    if (options.fastMode) {
        try {
            const result = await fastPreprocessing.process(file, {
                grayscale: options.grayscale,
                contrast: options.contrast,
                threshold: options.threshold !== -1,
                resizeWidth: 800,
                returnSteps: options.returnSteps
            });

            if (typeof result === 'string') {
                return { processedImage: result, tableData: undefined };
            } else {
                return {
                    processedImage: result.processedImage,
                    tableData: undefined,
                    steps: result.steps,
                    metrics: result.metrics
                };
            }
        } catch (err) {
            console.error("Fast Preprocessing Failed, falling back to OpenCV:", err);
            // Fallthrough to standard OpenCV
        }
    }

    // STANDARD MODE (Promise-based for image loading callback)
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            try {
                let src = cv.imread(img);

                // 1. Grayscale
                if (options.grayscale) {
                    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
                }

                // 2. Denoise
                if (options.denoise) {
                    try {
                        cv.fastNlMeansDenoising(src, src, 3, 7, 21);
                    } catch (e) {
                        let ksize = new cv.Size(3, 3);
                        cv.GaussianBlur(src, src, ksize, 0, 0, cv.BORDER_DEFAULT);
                    }
                }

                // 3. Deskew
                if (options.deskew) {
                    let lines = new cv.Mat();
                    let edges = new cv.Mat();
                    cv.Canny(src, edges, 50, 150, 3);
                    cv.HoughLines(edges, lines, 1, Math.PI / 180, 200, 0, 0, 0, Math.PI);

                    let angle = 0;
                    let numLines = 0;
                    if (lines.rows > 0) {
                        for (let i = 0; i < lines.rows; ++i) {
                            let theta = lines.data32F[i * 2 + 1];
                            if ((theta > Math.PI / 4 && theta < 3 * Math.PI / 4)) {
                                continue;
                            }
                            let deg = theta * 180 / Math.PI;
                            if (deg > 45) deg -= 90;
                            angle += deg;
                            numLines++;
                        }
                    }

                    if (numLines > 0) {
                        angle /= numLines;
                        if (Math.abs(angle) > 0.5) {
                            let center = new cv.Point(src.cols / 2, src.rows / 2);
                            let M = cv.getRotationMatrix2D(center, angle, 1);
                            cv.warpAffine(src, src, M, new cv.Size(src.cols, src.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
                            M.delete();
                        }
                    }
                    lines.delete();
                    edges.delete();
                }

                // 4. Adaptive Thresholding
                if (options.threshold >= 0) {
                    cv.adaptiveThreshold(src, src, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
                }

                // 5. Morphological Operations
                if (options.removeBorders) {
                    let kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
                    cv.morphologyEx(src, src, cv.MORPH_CLOSE, kernel);
                    kernel.delete();
                }

                let tableStructure: TableStructure | undefined;

                // 7. Table Detection
                if (options.detectTable) {
                    tableStructure = extractTableData(cv, src);
                }

                const outputCanvas = document.createElement('canvas');
                cv.imshow(outputCanvas, src);

                const processedImage = outputCanvas.toDataURL('image/jpeg', 0.9);

                src.delete();
                URL.revokeObjectURL(url);
                resolve({ processedImage, tableData: tableStructure });

            } catch (err) {
                console.error("OpenCV Processing Error:", err);
                reject(err);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };

        img.src = url;
    });
};

function extractTableData(cv: any, srcMat: any): TableStructure {
    let inverted = new cv.Mat();
    cv.bitwise_not(srcMat, inverted);

    let horizontalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.max(1, Math.floor(srcMat.cols / 40)), 1));
    let horizontalLines = new cv.Mat();
    cv.morphologyEx(inverted, horizontalLines, cv.MORPH_OPEN, horizontalKernel);

    let verticalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.max(1, Math.floor(srcMat.rows / 40))));
    let verticalLines = new cv.Mat();
    cv.morphologyEx(inverted, verticalLines, cv.MORPH_OPEN, verticalKernel);

    let tableGrid = new cv.Mat();
    cv.addWeighted(horizontalLines, 0.5, verticalLines, 0.5, 0.0, tableGrid);
    cv.threshold(tableGrid, tableGrid, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(tableGrid, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    let cells: CellData[] = [];

    let boundingBoxes: { x: number, y: number, w: number, h: number, area: number }[] = [];

    for (let i = 0; i < contours.size(); ++i) {
        let rect = cv.boundingRect(contours.get(i));
        let area = rect.width * rect.height;
        if (area > 500 && area < (srcMat.cols * srcMat.rows * 0.9)) {
            boundingBoxes.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height, area });
        }
    }

    boundingBoxes.sort((a, b) => {
        const rowThreshold = 20;
        if (Math.abs(a.y - b.y) < rowThreshold) {
            return a.x - b.x;
        }
        return a.y - b.y;
    });

    boundingBoxes.forEach((rect, index) => {
        let cellRoi = srcMat.roi(rect);

        // Use a temp canvas to convert ROI to data URL
        // In a worker, this might be tricky, but since we are main thread or simple service, assume document exists
        let cellCanvas = document.createElement('canvas');
        cv.imshow(cellCanvas, cellRoi);
        let cellDataUrl = cellCanvas.toDataURL('image/png');

        cells.push({
            id: index,
            row: 0,
            col: 0,
            x: rect.x,
            y: rect.y,
            width: rect.w,
            height: rect.h,
            imageData: cellDataUrl
        });

        cellRoi.delete();
    });

    inverted.delete();
    horizontalKernel.delete();
    horizontalLines.delete();
    verticalKernel.delete();
    verticalLines.delete();
    tableGrid.delete();
    contours.delete();
    hierarchy.delete();

    let vis = new cv.Mat();
    srcMat.copyTo(vis);
    cv.cvtColor(vis, vis, cv.COLOR_GRAY2RGB);

    for (let box of boundingBoxes) {
        let pt1 = new cv.Point(box.x, box.y);
        let pt2 = new cv.Point(box.x + box.w, box.y + box.h);
        cv.rectangle(vis, pt1, pt2, new cv.Scalar(0, 255, 0, 255), 2);
    }

    let gridCanvas = document.createElement('canvas');
    cv.imshow(gridCanvas, vis);
    let gridImage = gridCanvas.toDataURL('image/jpeg');
    vis.delete();

    return {
        rows: 0,
        cols: 0,
        cells,
        gridImage
    };
}
