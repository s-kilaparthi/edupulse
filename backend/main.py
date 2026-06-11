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
        subject_name = body.get('subject_name', '')
        chapter_context = body.get('chapter_context', '')
        topic_allocations = body.get('topic_allocations', [])
        difficulty_mix = body.get('difficulty_mix', {'easy': 30, 'medium': 50, 'hard': 20})
        board = body.get('board', 'CBSE')
        class_level = body.get('class_level', '')

        if not topic_allocations:
            raise HTTPException(
                status_code=400,
                detail="topic_allocations required",
            )

        gemini_key = os.environ.get('GEMINI_API_KEY', '')
        if not gemini_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")

        easy_pct = difficulty_mix.get('easy', 30)
        medium_pct = difficulty_mix.get('medium', 50)
        hard_pct = difficulty_mix.get('hard', 20)

        topics_with_counts = '\n'.join([
            f"- {t['topic_name']}: {t['count']} questions"
            for t in topic_allocations
        ])

        total_questions = sum(t['count'] for t in topic_allocations)
        easy_count = max(1, round(total_questions * easy_pct / 100))
        medium_count = max(1, round(total_questions * medium_pct / 100))
        hard_count = total_questions - easy_count - medium_count
        if hard_count < 0:
            hard_count = 0

        prompt = f"""You are an expert {board} teacher for {class_level}.
Generate MCQ questions for a {board} exam.

Subject: {subject_name}
Context/Chapter: {chapter_context}

Generate questions for these topics with EXACT counts:
{topics_with_counts}

Total: {total_questions} questions with this difficulty distribution:
- {easy_count} EASY questions (factual recall, definitions, direct formulas)
- {medium_count} MEDIUM questions (application, short calculations, concept application)
- {hard_count} HARD questions (analysis, multi-step problems, higher order thinking)

STRICT RULES:
- Each question must belong to the exact topic specified
- Do NOT mix topics or subjects
- Context/Chapter "{chapter_context}" defines the scope
- Each question has exactly 4 options (A, B, C, D)
- Wrong options must be plausible and related
- One unambiguous correct answer
- Appropriate for {board} {class_level} level
- Distribute difficulty across topics proportionally

Return ONLY a JSON array, no explanation:
[
  {{
    "topic_name": "exact topic name",
    "difficulty": "easy|medium|hard",
    "question_text": "question?",
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

        name_to_id = {t['topic_name']: t['topic_id'] for t in topic_allocations}
        for q in questions:
            q['topic_id'] = name_to_id.get(
                q.get('topic_name'),
                topic_allocations[0]['topic_id'],
            )

        return {"questions": questions}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Generate questions error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/register-institute")
async def register_institute(request: Request):
    try:
        body = await request.json()
        institute_name = body.get('institute_name')
        city = body.get('city')
        state = body.get('state')
        admin_name = body.get('admin_name')
        admin_email = body.get('admin_email')
        password = body.get('password')

        if not all([institute_name, city, state, admin_name, admin_email, password]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_service_key = os.environ.get('SUPABASE_SERVICE_KEY')
        if not supabase_url or not supabase_service_key:
            raise HTTPException(status_code=500, detail="Supabase service credentials not configured")

        supabase_admin = create_client(supabase_url, supabase_service_key)

        institute_response = supabase_admin.from_('institutes').insert({
            "name": institute_name.strip(),
            "city": city.strip(),
            "state": state.strip(),
        }).select('id').single().execute()

        if not institute_response.data:
            raise HTTPException(status_code=500, detail="Failed to create institute")

        institute_id = institute_response.data['id']

        auth_response = supabase_admin.auth.admin.create_user({
            "email": admin_email.strip(),
            "password": password,
            "email_confirm": True,
        })

        user_id = auth_response.user.id

        supabase_admin.from_('users').insert({
            "id": user_id,
            "name": admin_name.strip(),
            "email": admin_email.strip(),
            "role": "admin",
            "institute_id": institute_id,
        }).execute()

        return {"success": True, "institute_id": institute_id}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Register institute error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/create-student")
async def create_student(request: Request):
    try:
        body = await request.json()
        password = body.get('password')
        name = body.get('name')
        roll_number = body.get('roll_number')
        institute_id = body.get('institute_id')
        class_id = body.get('class_id', None)
        email = f"roll{roll_number}@edupulse.com"

        if not all([password, name, roll_number, institute_id]):
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
            "class_id": class_id,
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


@app.delete("/delete-user/{user_id}")
async def delete_user(user_id: str):
    try:
        supabase_admin = create_client(
            os.environ.get('SUPABASE_URL'),
            os.environ.get('SUPABASE_SERVICE_KEY')
        )

        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception as auth_err:
            print(f"Auth delete skipped (user may not exist): {auth_err}")

        supabase_admin.from_('users').delete().eq('id', user_id).execute()

        return {"success": True}

    except Exception as e:
        import traceback
        print("Delete user error:", traceback.format_exc())
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
