import base64
import json
import os

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

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

        models_to_try = [
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.0-flash-001',
        ]

        request_body = {
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

        data = None
        last_error = None
        async with httpx.AsyncClient(timeout=30.0) as client:
            for model in models_to_try:
                response = await client.post(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}',
                    json=request_body
                )
                data = response.json()
                if 'candidates' in data:
                    break
                last_error = data.get('error', {}).get('message', 'Unknown error')

        if not data or 'candidates' not in data:
            raise ValueError(f"All Gemini models unavailable: {last_error}")

        text = data['candidates'][0]['content']['parts'][0]['text']
        clean = text.replace('```json', '').replace('```', '').strip()

        topics = json.loads(clean)
        return {"topics": topics}

    except Exception as e:
        import traceback
        print("Extract topics error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-questions")
async def generate_questions(request: Request):
    try:
        body = await request.json()
        subject_id = body.get('subject_id')
        topic_ids = body.get('topic_ids', [])
        count_per_topic = body.get('count_per_topic', 2)
        difficulty = body.get('difficulty', 'medium')
        subject_name = body.get('subject_name', '')
        topic_names = body.get('topic_names', [])

        if not topic_ids or not topic_names:
            raise HTTPException(
                status_code=400,
                detail="topic_ids and topic_names required",
            )

        gemini_key = os.environ.get('GEMINI_API_KEY', '')
        if not gemini_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")

        topics_text = ', '.join(topic_names)
        prompt = f"""You are an expert teacher creating MCQ questions.
Generate {count_per_topic} multiple choice questions for EACH of these topics: {topics_text}
Subject: {subject_name}
Difficulty: {difficulty}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- One correct answer per question
- Questions should be clear and unambiguous
- Match the difficulty level: easy=basic recall, medium=application, hard=analysis

Return ONLY a JSON array, no explanation. Format:
[
  {{
    "topic_name": "topic name here",
    "question_text": "question here?",
    "option_a": "option A",
    "option_b": "option B",
    "option_c": "option C",
    "option_d": "option D",
    "correct_answer": "A"
  }}
]"""

        models_to_try = [
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.0-flash-001',
        ]

        data = None
        last_error = None
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in models_to_try:
                response = await client.post(
                    f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}',
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                data = response.json()
                if 'candidates' in data:
                    break
                last_error = data.get('error', {}).get('message', 'Unknown')

        if not data or 'candidates' not in data:
            raise ValueError(f"Gemini unavailable: {last_error}")

        text = data['candidates'][0]['content']['parts'][0]['text']
        clean = text.replace('```json', '').replace('```', '').strip()

        questions = json.loads(clean)

        topic_name_to_id = dict(zip(topic_names, topic_ids))
        for q in questions:
            q['topic_id'] = topic_name_to_id.get(q.get('topic_name'), topic_ids[0])

        return {"questions": questions}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Generate questions error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-student")
async def create_student(request: Request):
    try:
        body = await request.json()
        email = body.get('email')
        password = body.get('password')
        name = body.get('name')
        roll_number = body.get('roll_number')
        institute_id = body.get('institute_id')

        if not all([email, password, name, roll_number, institute_id]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        supabase_admin = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_SERVICE_KEY')
        )

        auth_response = supabase_admin.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })

        user_id = auth_response.user.id

        supabase_admin.from_('users').insert({
            "id": user_id,
            "name": name,
            "roll_number": roll_number,
            "email": email,
            "role": "student",
            "institute_id": institute_id,
        }).execute()

        return {"success": True, "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Create student error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-teacher")
async def create_teacher(request: Request):
    try:
        body = await request.json()
        email = body.get('email')
        password = body.get('password')
        name = body.get('name')
        institute_id = body.get('institute_id')

        if not all([email, password, name, institute_id]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        supabase_admin = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_SERVICE_KEY')
        )

        auth_response = supabase_admin.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
        })

        user_id = auth_response.user.id

        supabase_admin.from_('users').insert({
            "id": user_id,
            "name": name,
            "email": email,
            "role": "teacher",
            "institute_id": institute_id,
        }).execute()

        return {"success": True, "user_id": user_id}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Create teacher error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/gemini-models")
async def list_gemini_models():
    import httpx
    import os
    gemini_key = os.environ.get('GEMINI_API_KEY', '')
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f'https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}'
        )
    return response.json()
