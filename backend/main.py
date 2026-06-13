import base64
import json
import os
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

from omr.scanner import scan_omr

app = FastAPI()


def _supabase_admin():
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_service_key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not supabase_url or not supabase_service_key:
        raise HTTPException(status_code=500, detail="Supabase service credentials not configured")
    return create_client(supabase_url, supabase_service_key)


async def verify_superadmin(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = auth_header.split(' ')[1]
    supabase_admin = _supabase_admin()
    user = supabase_admin.auth.get_user(token)
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = supabase_admin.from_('superadmins').select('id').eq('id', user.user.id).execute()
    if not result.data:
        raise HTTPException(status_code=403, detail="Not a superadmin")
    return user.user.id


def _count_rows(supabase_admin, table, filters=None):
    query = supabase_admin.from_(table).select('id', count='exact', head=True)
    if filters:
        for column, value in filters.items():
            query = query.eq(column, value)
    result = query.execute()
    return result.count or 0


def _role_counts_by_institute(supabase_admin):
    result = supabase_admin.from_('users').select('institute_id, role').execute()
    counts = {}
    for row in result.data or []:
        institute_id = row.get('institute_id')
        if not institute_id:
            continue
        if institute_id not in counts:
            counts[institute_id] = {
                'total_admins': 0,
                'total_teachers': 0,
                'total_students': 0,
            }
        role = row.get('role')
        if role == 'admin':
            counts[institute_id]['total_admins'] += 1
        elif role == 'teacher':
            counts[institute_id]['total_teachers'] += 1
        elif role == 'student':
            counts[institute_id]['total_students'] += 1
    return counts

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

        result = supabase_admin.from_('institutes').insert({
            "name": institute_name.strip(),
            "city": city.strip(),
            "state": state.strip(),
        }).execute()
        institute_id = result.data[0]['id']

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

        supabase_admin.from_('exam_types').insert([
            {"name": "Class Test", "institute_id": institute_id},
            {"name": "Mid Exam", "institute_id": institute_id},
            {"name": "Final Exam", "institute_id": institute_id},
        ]).execute()

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

        parent_phone = body.get('parent_phone')
        parent_name = body.get('parent_name')
        if parent_phone and str(parent_phone).strip():
            parent_email = f"parent{roll_number}@edupulse.com"
            parent_auth_response = supabase_admin.auth.admin.create_user({
                "email": parent_email,
                "password": str(roll_number),
                "email_confirm": True,
            })
            parent_user_id = parent_auth_response.user.id
            display_parent_name = (
                parent_name.strip()
                if parent_name and str(parent_name).strip()
                else f"Parent of {name}"
            )
            supabase_admin.from_('users').insert({
                "id": parent_user_id,
                "name": display_parent_name,
                "email": parent_email,
                "role": "parent",
                "institute_id": institute_id,
                "class_id": class_id,
                "roll_number": roll_number,
                "parent_phone": str(parent_phone).strip(),
                "parent_name": parent_name.strip() if parent_name and str(parent_name).strip() else None,
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

        student_roll_number = None
        student_institute_id = None

        user_result = supabase_admin.from_('users').select('id, roll_number, institute_id').eq('id', user_id).limit(1).execute()
        if user_result.data:
            student_roll_number = user_result.data[0].get('roll_number')
            student_institute_id = user_result.data[0].get('institute_id')

        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception as auth_err:
            print(f"Auth delete skipped (user may not exist): {auth_err}")

        supabase_admin.from_('users').delete().eq('id', user_id).execute()

        if student_roll_number is not None and student_institute_id is not None:
            parent_result = (
                supabase_admin.from_('users')
                .select('id')
                .eq('roll_number', student_roll_number)
                .eq('role', 'parent')
                .eq('institute_id', student_institute_id)
                .limit(1)
                .execute()
            )
            if parent_result.data:
                parent_id = parent_result.data[0]['id']
                try:
                    supabase_admin.auth.admin.delete_user(parent_id)
                except Exception as auth_err:
                    print(f"Parent auth delete skipped (user may not exist): {auth_err}")
                supabase_admin.from_('users').delete().eq('id', parent_id).execute()

        return {"success": True}

    except Exception as e:
        import traceback
        print("Delete user error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/superadmin/institutes")
async def superadmin_list_institutes(request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        institutes_result = (
            supabase_admin
            .from_('institutes')
            .select('id, name, city, state, created_at, is_active')
            .order('created_at', desc=True)
            .execute()
        )
        role_counts = _role_counts_by_institute(supabase_admin)

        institutes = []
        for institute in institutes_result.data or []:
            counts = role_counts.get(institute['id'], {})
            institutes.append({
                **institute,
                'total_admins': counts.get('total_admins', 0),
                'total_teachers': counts.get('total_teachers', 0),
                'total_students': counts.get('total_students', 0),
                'is_active': institute.get('is_active', True),
            })

        return {'institutes': institutes}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin list institutes error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/superadmin/institute/{institute_id}")
async def superadmin_get_institute(institute_id: str, request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        institute_result = (
            supabase_admin
            .from_('institutes')
            .select('id, name, city, state, created_at, is_active')
            .eq('id', institute_id)
            .limit(1)
            .execute()
        )
        if not institute_result.data:
            raise HTTPException(status_code=404, detail="Institute not found")

        users_result = (
            supabase_admin
            .from_('users')
            .select('id, name, email, role, is_active')
            .eq('institute_id', institute_id)
            .order('role')
            .execute()
        )

        classes_result = supabase_admin.from_('classes').select('id').eq('institute_id', institute_id).execute()
        class_ids = [c['id'] for c in (classes_result.data or [])]
        total_exams = 0
        if class_ids:
            exams_result = supabase_admin.from_('exam_classes').select('exam_id', count='exact').in_('class_id', class_ids).execute()
            total_exams = exams_result.count or 0

        return {
            'institute': institute_result.data[0],
            'users': users_result.data or [],
            'total_exams': total_exams,
            'total_classes': _count_rows(supabase_admin, 'classes', {'institute_id': institute_id}),
            'total_announcements': _count_rows(
                supabase_admin, 'announcements', {'institute_id': institute_id}
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin get institute error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/superadmin/institute/{institute_id}/suspend")
async def superadmin_suspend_institute(institute_id: str, request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        institute_result = (
            supabase_admin
            .from_('institutes')
            .select('id')
            .eq('id', institute_id)
            .limit(1)
            .execute()
        )
        if not institute_result.data:
            raise HTTPException(status_code=404, detail="Institute not found")

        supabase_admin.from_('institutes').update({'is_active': False}).eq('id', institute_id).execute()
        supabase_admin.from_('users').update({'is_active': False}).eq('institute_id', institute_id).execute()

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin suspend institute error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/superadmin/institute/{institute_id}/activate")
async def superadmin_activate_institute(institute_id: str, request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        institute_result = (
            supabase_admin
            .from_('institutes')
            .select('id')
            .eq('id', institute_id)
            .limit(1)
            .execute()
        )
        if not institute_result.data:
            raise HTTPException(status_code=404, detail="Institute not found")

        supabase_admin.from_('institutes').update({'is_active': True}).eq('id', institute_id).execute()
        supabase_admin.from_('users').update({'is_active': True}).eq('institute_id', institute_id).execute()

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin activate institute error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/superadmin/institute/{institute_id}")
async def superadmin_delete_institute(institute_id: str, request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        institute_result = (
            supabase_admin
            .from_('institutes')
            .select('id')
            .eq('id', institute_id)
            .limit(1)
            .execute()
        )
        if not institute_result.data:
            raise HTTPException(status_code=404, detail="Institute not found")

        users_result = (
            supabase_admin
            .from_('users')
            .select('id')
            .eq('institute_id', institute_id)
            .execute()
        )
        user_ids = [row['id'] for row in users_result.data or []]

        supabase_admin.from_('institutes').delete().eq('id', institute_id).execute()

        for user_id in user_ids:
            try:
                supabase_admin.auth.admin.delete_user(user_id)
            except Exception as auth_err:
                print(f"Auth delete skipped for {user_id}: {auth_err}")

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin delete institute error:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/superadmin/stats")
async def superadmin_stats(request: Request):
    try:
        await verify_superadmin(request)
        supabase_admin = _supabase_admin()

        now = datetime.now(timezone.utc)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

        new_institutes_result = (
            supabase_admin
            .from_('institutes')
            .select('id', count='exact', head=True)
            .gte('created_at', first_of_month)
            .execute()
        )

        return {
            'total_institutes': _count_rows(supabase_admin, 'institutes'),
            'total_students': _count_rows(supabase_admin, 'users', {'role': 'student'}),
            'total_teachers': _count_rows(supabase_admin, 'users', {'role': 'teacher'}),
            'total_exams': _count_rows(supabase_admin, 'exams'),
            'total_announcements': _count_rows(supabase_admin, 'announcements'),
            'new_institutes_this_month': new_institutes_result.count or 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print("Superadmin stats error:", traceback.format_exc())
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
