import sys
import os
import json
import cv2
import numpy as np
import warnings
import fitz  # PyMuPDF
import argparse
import re
from paddleocr import PaddleOCR

warnings.filterwarnings("ignore")

# ---------- Helpers ----------

def auto_rotate(img):
    """Detect Tamil text direction + rotate properly"""
    try:
        ocr_tmp = PaddleOCR(lang='ta', use_angle_cls=True, show_log=False)
        res = ocr_tmp.ocr(img, cls=True)

        if res and res[0]:
            angle = res[0][0][1][2]   # Paddle gives rotation
            if abs(angle) > 1:
                (h,w)=img.shape[:2]
                M=cv2.getRotationMatrix2D((w//2,h//2),-angle,1)
                img=cv2.warpAffine(img,M,(w,h))
    except:
        pass
    return img


def pdf_to_images(path):
    images=[]
    doc=fitz.open(path)

    for page in doc:
        pix = page.get_pixmap(dpi=220)
        img = np.frombuffer(pix.samples, dtype=np.uint8)
        img = img.reshape(pix.h, pix.w, 3)
        images.append(img)

    return images


def load_images_from_path(path):
    if path.lower().endswith(".pdf"):
        return pdf_to_images(path)
    img=cv2.imread(path)
    return [img] if img is not None else []


def normalize_text(text):
    text=text.replace("\u200c"," ").strip()
    return re.sub(r"\s+"," ",text)


# ---------- FIELD EXTRACTION ----------

def extract_fields(text):
    fields={
        "documentType":"Unknown",
        "pattaNumber":"",
        "batchNumber":"",
        "surveyNumber":"",
        "ownerName":"",
        "village":"",
        "taluk":"",
        "district":"",
        "date":"",
        "summary":""
    }

    t = normalize_text(text)

    # Tamil + English patterns
    pattas = [
        r"(?:பட்டா\s*எண்|Patta\s*No)\s*[:\- ]+(\d+)"
    ]
    for p in pattas:
        m=re.search(p,t,re.I)
        if m: fields["pattaNumber"]=m.group(1)

    batch=re.search(r"(?:தொகுப்பு\s*வரிசை\s*எண்|Thokuppu)\s*[:\- ]+([\w\/\-\.]+)",t)
    if batch: fields["batchNumber"]=batch.group(1)

    survey=re.search(r"(?:சர்வே\s*எண்|Survey\s*No)\s*[:\- ]+([\w\/\-\.]+)",t)
    if survey: fields["surveyNumber"]=survey.group(1)

    owner=re.search(r"(?:உடைமையாளர்(?:ின்)?\s*பெயர்|Owner)\s*[:\- ]+([^\n]+)",text)
    if owner: fields["ownerName"]=owner.group(1).strip()

    # doc classification
    if re.search(r"விற்பனை|Sale",t): fields["documentType"]="Sale Deed"
    elif re.search(r"பட்டா",t): fields["documentType"]="Patta"
    elif re.search(r"உத்தரவு|Order",t): fields["documentType"]="Government Order"

    # summary
    parts=[]
    parts.append(f"Document Type: {fields['documentType']}")
    if fields["pattaNumber"]: parts.append(f"Patta No: {fields['pattaNumber']}")
    if fields["surveyNumber"]: parts.append(f"Survey No: {fields['surveyNumber']}")
    if fields["ownerName"]: parts.append(f"Owner: {fields['ownerName']}")
    fields["summary"]=" | ".join(parts)

    return fields


if __name__ == "__main__":
    # Get path from Environment Variable
    image_path = os.environ.get("OCR_IMAGE_PATH")

    if not image_path or not os.path.exists(image_path):
        print(json.dumps({"status":"error","message":f"File not found or OCR_IMAGE_PATH not set: {image_path}"}))
        sys.exit(1)

    # NUCLEAR OPTION: Clear sys.argv completely to prevent PaddleOCR from seeing ANY arguments
    import sys
    sys.argv = []

    images = load_images_from_path(image_path)

    try:
        ocr = PaddleOCR(lang="ta", use_angle_cls=True, show_log=False)

        all_text=[]
        for img in images:
            img = auto_rotate(img)
            res = ocr.ocr(img, cls=True)

            if res and res[0]:
                for line in res[0]:
                    all_text.append(line[1][0])

        full_text="\n".join(all_text)
        
        # Write to absolute path if possible, or relative to script dir
        # Using a fixed filename in the current directory
        with open("output.txt", "w", encoding="utf-8") as f:
            f.write(full_text)

        fields = extract_fields(full_text)

        print(json.dumps({
            "status":"success",
            "text":full_text,
            "fields":fields
        }, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
