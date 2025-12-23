import sys
import os
import json
import easyocr
import cv2
import numpy as np
import warnings
import fitz  # PyMuPDF
import argparse

# Suppress warnings
warnings.filterwarnings("ignore")

def load_images_from_path(path):
    """
    Load images from path. Supports:
    - Images: JPG, PNG, TIFF, etc. (Returns [img])
    - PDF: Returns list of images (one per page)
    """
    try:
        lower_path = path.lower()
        if lower_path.endswith('.pdf'):
            doc = fitz.open(path)
            images = []
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                # Render page to image (zoom=2 for better quality)
                mat = fitz.Matrix(2, 2)
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to numpy array (RGB)
                img_data = pix.tobytes("ppm")
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is not None:
                    images.append(img)
            return images, None
        else:
            # Standard Image
            img = cv2.imread(path)
            if img is None:
                return None, "Failed to load image (unsupported format?)"
            return [img], None
    except Exception as e:
        return None, f"Error loading file: {str(e)}"

def preprocess_image_array(img):
    """
    Apply OpenCV preprocessing to a numpy image array
    """
    try:
        if img is None:
            return None, "Empty image"

        # 1. Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 2. Resize (Disabled by user request)
        # height, width = gray.shape
        # if width < 1000:
        #    ...

        # 3. Denoise
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)

        return denoised, None
    except Exception as e:
        return None, str(e)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('image_path', help='Path to file')
    parser.add_argument('--mode', choices=['preprocess', 'ocr', 'full'], default='full')
    
    args = parser.parse_args()
    image_path = args.image_path
    
    if not os.path.exists(image_path):
        print(json.dumps({"status": "error", "message": f"File not found: {image_path}"}))
        sys.exit(1)

    # Set stdout encoding
    if sys.stdout.encoding != 'utf-8':
         sys.stdout.reconfigure(encoding='utf-8')

    # Load Images (1 or many)
    images, error = load_images_from_path(image_path)
    
    if images is None:
        print(json.dumps({"status": "error", "message": error}))
        sys.exit(1)
        
    if len(images) == 0:
        print(json.dumps({"status": "error", "message": "No images extracted from file"}))
        sys.exit(1)

    if args.mode == 'preprocess':
        # For preprocess mode, we typically want a preview. 
        # For PDF, let's just preprocess and return the FIRST page as the preview image.
        # Or ideally store all? For dashboard preview, 1st page is sufficient.
        
        first_page_img = images[0]
        processed, error = preprocess_image_array(first_page_img)
        
        if processed is not None:
            base, ext = os.path.splitext(image_path)
            # Force jpg extension for the preview output
            output_path = f"{base}_processed.jpg"
            cv2.imwrite(output_path, processed)
            
            print(json.dumps({
                "status": "success", 
                "message": f"Preprocessing complete ({len(images)} pages)",
                "processed_path": output_path,
                "page_count": len(images)
            }))
        else:
            print(json.dumps({"status": "error", "message": error}))
            
    elif args.mode == 'ocr':
        try:
            reader = easyocr.Reader(['ta', 'en'], gpu=True)
            
            full_text_lines = []
            all_blocks = []
            
            for idx, img in enumerate(images):
                # Preprocess first
                processed, _ = preprocess_image_array(img)
                if processed is None: processed = img # Fallback
                
                # Run OCR
                results = reader.readtext(processed, detail=1, paragraph=False)
                
                for (bbox, text, prob) in results:
                    serialized_bbox = [[int(pt[0]), int(pt[1])] for pt in bbox]
                    all_blocks.append({
                        "text": text,
                        "confidence": float(prob),
                        "box": serialized_bbox,
                        "page": idx + 1
                    })
                    full_text_lines.append(text)
                
                # Add page break marker if multiple pages
                if len(images) > 1:
                    full_text_lines.append(f"\n--- Page {idx+1} ---\n")

            print(json.dumps({
                "status": "success",
                "full_text": "\n".join(full_text_lines),
                "blocks": all_blocks,
                "confidence": 0.95
            }, ensure_ascii=False))
            
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}))
            
    else:
        # Full Legacy Mode (Just first page or single image for backward compat if needed)
        # But for this task, the app uses 'preprocess' and 'ocr' modes now.
        print(json.dumps({"status": "error", "message": "Please use --mode preprocess or --mode ocr"}))
