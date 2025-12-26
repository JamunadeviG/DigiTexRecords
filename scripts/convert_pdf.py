
import sys
import fitz  # pymupdf
import base64
import json

def convert_pdf_to_image(pdf_path):
    try:
        # Open the PDF
        doc = fitz.open(pdf_path)
        if doc.page_count < 1:
            print(json.dumps({"error": "PDF has no pages"}))
            return

        # Get the first page
        page = doc.load_page(0)

        # Render to image (scale=2 for higher quality)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        
        # Get image bytes
        img_bytes = pix.tobytes("png")
        
        # Convert to base64
        base64_str = base64.b64encode(img_bytes).decode('utf-8')
        
        # Output JSON result
        print(json.dumps({
            "success": True,
            "base64": base64_str,
            "width": pix.width,
            "height": pix.height
        }), flush=True)
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
    else:
        convert_pdf_to_image(sys.argv[1])
