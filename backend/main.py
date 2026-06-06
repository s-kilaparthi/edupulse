import base64
import json
import os

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from omr.scanner import scan_omr

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OMR_TMP_PATH = "/tmp/omr_scan.jpg"


@app.get("/health")
def health():
    return {"status": "ok", "project": "EduPulse", "week": 1, "day": 1}


@app.post("/scan-omr")
async def scan_omr_endpoint(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload must be an image file")

    try:
        contents = await file.read()
        with open(OMR_TMP_PATH, "wb") as f:
            f.write(contents)

        result = scan_omr(OMR_TMP_PATH, debug=True)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/extract-topics")
async def extract_topics(file: UploadFile = File(...)):
    if not file.content_type or file.content_type != 'application/pdf':
        raise HTTPException(status_code=400, detail="Upload must be a PDF file")

    try:
        contents = await file.read()
        pdf_base64 = base64.b64encode(contents).decode('utf-8')

        gemini_key = os.environ.get('GEMINI_API_KEY', '')
        if not gemini_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}',
                json={
                    "contents": [{
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": "application/pdf",
                                    "data": pdf_base64
                                }
                            },
                            {
                                "text": "You are an educational content analyzer. Extract all the main topics and subtopics from this textbook chapter. Return ONLY a JSON array of topic names, nothing else. Each topic should be concise (2-5 words). Maximum 20 topics. Example: [\"Kinematics\", \"Laws of Motion\"] Return only the JSON array, no explanation."
                            }
                        ]
                    }]
                }
            )

        data = response.json()
        if 'error' in data:
            raise ValueError(f"Gemini API error: {data['error'].get('message', str(data['error']))}")
        if 'candidates' not in data or not data['candidates']:
            raise ValueError(f"Gemini returned no candidates. Response: {str(data)[:200]}")
        text = data['candidates'][0]['content']['parts'][0]['text']
        clean = text.replace('```json', '').replace('```', '').strip()

        topics = json.loads(clean)
        return {"topics": topics}

    except Exception as e:
        import traceback
        print("Extract topics error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
