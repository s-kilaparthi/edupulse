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
