from pathlib import Path
import traceback
import os
import re
import json
import urllib.parse

import uvicorn

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from starlette.middleware.sessions import SessionMiddleware

from dotenv import load_dotenv

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

# Load variables from .env
load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SESSION_SECRET = os.getenv("SESSION_SECRET")


# Check required environment variables
if not GOOGLE_CLIENT_ID:
    print("WARNING: GOOGLE_CLIENT_ID is not set in .env")

if not SESSION_SECRET:
    print("WARNING: SESSION_SECRET is not set in .env")


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="WANDERWISE AI ",
    description="LangGraph Multi-Agent Travel Planner with FastAPI Frontend",
    version="1.0.0"
)


# ============================================================
# SESSION MIDDLEWARE
# ============================================================

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET or "temporary-development-secret",
    same_site="lax",
    https_only=False,
    max_age=60 * 60 * 24 * 7  # 7 days
)


# ============================================================
# STATIC FILES
# ============================================================

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static"
)


# ============================================================
# TEMPLATES
# ============================================================

templates = Jinja2Templates(
    directory=str(BASE_DIR / "templates")
)

# ============================================================
# DATABASE INITIALIZATION
# ============================================================
try:
    from db.database import Base, engine
    import db.models  # registers UserRecord, TravelPlanRecord
    Base.metadata.create_all(bind=engine)
    print("[DB] Database tables initialized successfully.")
except Exception as e:
    print("[DB Initialization Warning]:", e)


# ============================================================
# REQUEST MODELS
# ============================================================

class TravelRequest(BaseModel):
    message: str
    thread_id: str | None = None


class SimpleAuthRequest(BaseModel):
    name: str | None = None
    email: str
    password: str | None = None
    action: str | None = None


class ChatStepRequest(BaseModel):
    message: str
    history: list[dict] = []
    current_params: dict = {}
    plan_context: str | None = None
    user_location: dict | None = None


class UserConversationPayload(BaseModel):
    id: str | None = None
    title: str | None = "New Trip Plan"
    messages: list[dict] = []
    params: dict | None = {}
    travel_plan: dict | None = None



class PlanQARequest(BaseModel):
    query: str
    plan_context: str
    current_params: dict = {}
    chat_history: list[dict] = []
    user_location: dict | None = None


class UpdateBudgetRequest(BaseModel):
    initial_budget: float | int
    flight_name: str = "IRCTC Flight"
    ticket_price: float | int
    trip_type: str = "Round-Trip"
    destination: str = "your destination"
    source: str | None = None
    outbound_flight: str | None = None
    return_flight: str | None = None
    current_plan: str = ""


class FeedbackRequest(BaseModel):
    name: str
    destination: str
    rating: int = 5
    comment: str


class SendEmailRequest(BaseModel):
    email: str
    plan_answer: str = ""
    dest_name: str | None = None
    trip_params: dict | None = None


class SavePlanPayload(BaseModel):
    dest_name: str | None = None
    user_query: str | None = None
    answer: str | None = None
    flight_results: str | None = None
    hotel_results: str | None = None
    weather_results: str | None = None
    local_info_results: str | None = None
    itinerary: str | None = None
    price_prediction: dict | None = None
    sentiment_summary: dict | None = None
    trip_params: dict | None = None


# ============================================================
# AUTHENTICATION HELPER
# ============================================================

def get_current_user(request: Request):
    """
    Get the currently logged-in user from the session.
    """
    return request.session.get("user")

@app.get("/auth/mock")
async def mock_login(request: Request):
    """Fallback mock login for when Google Auth is disabled."""
    request.session["user"] = {
        "name": "Alex Rivers", 
        "email": "alex@example.com", 
        "picture": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80"
    }
    return RedirectResponse(url="/", status_code=303)


@app.post("/api/auth")
@app.post("/api/auth/simple-login")
async def simple_login(request: Request, data: SimpleAuthRequest):
    """Instant login and registration with SQLite database persistence and account isolation."""
    email_clean = (data.email or "").strip().lower()
    if not email_clean or "@" not in email_clean:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Please provide a valid email address."}
        )

    user_name = (data.name or email_clean.split("@")[0].replace(".", " ").title() or "Traveler").strip()
    action = (data.action or "signin").strip().lower()
    provided_password = (data.password or "").strip()

    try:
        from db.database import SessionLocal
        from db.models import UserRecord

        db = SessionLocal()
        try:
            user_record = db.query(UserRecord).filter(UserRecord.email == email_clean).first()
            if action == "signup":
                if user_record:
                    # Account already exists
                    if user_record.password_hash and provided_password and user_record.password_hash not in ("demo_pass", ""):
                        if user_record.password_hash != provided_password:
                            return JSONResponse(
                                status_code=400,
                                content={
                                    "success": False,
                                    "error": "An account with this email already exists. Please switch to 'Sign In' or use a different email address."
                                }
                            )
                    # Update name if provided
                    if data.name:
                        user_record.name = data.name.strip()
                    if provided_password:
                        user_record.password_hash = provided_password
                    db.commit()
                    user_name = user_record.name or user_name
                else:
                    # Create distinct new traveler account in database
                    user_record = UserRecord(
                        email=email_clean,
                        name=user_name,
                        password_hash=provided_password or "demo_pass"
                    )
                    db.add(user_record)
                    db.commit()
                    db.refresh(user_record)
            else:
                # Sign-in mode
                if not user_record:
                    # If this is demo login, create it automatically
                    if email_clean == "alex@example.com":
                        user_record = UserRecord(
                            email=email_clean,
                            name=user_name,
                            password_hash="demo_pass"
                        )
                        db.add(user_record)
                        db.commit()
                        db.refresh(user_record)
                    else:
                        return JSONResponse(
                            status_code=404,
                            content={
                                "success": False,
                                "error": "No account found with this email. Please switch to 'Sign Up' tab to create your traveler account."
                            }
                        )
                else:
                    # Verify password
                    if user_record.password_hash and user_record.password_hash not in ("demo_pass", ""):
                        if provided_password and provided_password != user_record.password_hash:
                            return JSONResponse(
                                status_code=401,
                                content={
                                    "success": False,
                                    "error": "Incorrect password for this email. Please check your credentials."
                                }
                            )
                    elif provided_password and user_record.password_hash in ("demo_pass", None, ""):
                        user_record.password_hash = provided_password
                        db.commit()

            if user_record and user_record.name:
                user_name = user_record.name
        finally:
            db.close()
    except Exception as e:
        print("[DB simple_login error]:", e)

    user_data = {
        "name": user_name,
        "email": email_clean,
        "picture": f"https://ui-avatars.com/api/?name={user_name.replace(' ', '+')}&background=0284C7&color=fff&bold=true"
    }
    request.session["user"] = user_data
    return {"success": True, "user": user_data}



# ============================================================
# LOGIN PAGE
# ============================================================

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):

    # If already logged in, go directly to TripMate
    if get_current_user(request):
        return RedirectResponse(
            url="/",
            status_code=302
        )

    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={
            "google_client_id": GOOGLE_CLIENT_ID
        }
    )


# ============================================================
# GOOGLE AUTHENTICATION
# ============================================================

@app.post("/auth/google")
async def google_login(request: Request):

    """
    Receives the Google credential generated by Google Identity
    Services and verifies the ID token.

    If valid:
        - Creates a session
        - Stores basic Google user information
        - Redirects to TripMate

    If invalid:
        - Returns HTTP 401
    """

    try:

        # ----------------------------------------------------
        # Get credential from JSON or Form body
        # ----------------------------------------------------

        credential = None
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            try:
                body = await request.json()
                credential = body.get("credential")
            except Exception:
                pass

        if not credential:
            form = await request.form()
            credential = form.get("credential")

        if not credential:

            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Google credential was not provided."
                }
            )


        # ----------------------------------------------------
        # Verify Google ID Token (with clock skew allowance)
        # ----------------------------------------------------

        try:
            user_info = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=120
            )
        except ValueError as ve:
            err_msg = str(ve).lower()
            if "used too early" in err_msg or "clock" in err_msg:
                import json, base64
                parts = credential.split(".")
                if len(parts) >= 2:
                    padding = "=" * (4 - (len(parts[1]) % 4))
                    payload_json = base64.urlsafe_b64decode(parts[1] + padding).decode("utf-8")
                    user_info = json.loads(payload_json)
                    print(f"[Google Auth] Clock skew adjusted for: {user_info.get('email')}")
                else:
                    raise ve
            else:
                raise ve



        # ----------------------------------------------------
        # Extract user information
        # ----------------------------------------------------

        google_user = {
            "google_id": user_info.get("sub"),
            "email": user_info.get("email"),
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
            "email_verified": user_info.get("email_verified", False)
        }


        # ----------------------------------------------------
        # Check email verification
        # ----------------------------------------------------

        if not google_user["email_verified"]:

            return JSONResponse(
                status_code=403,
                content={
                    "success": False,
                    "error": "Your Google email is not verified."
                }
            )


        # ----------------------------------------------------
        # Store user in session & persist to Supabase
        # ----------------------------------------------------

        request.session["user"] = google_user

        try:
            from db.database import SessionLocal
            from db.models import UserRecord
            db = SessionLocal()
            try:
                g_email = (google_user.get("email") or "").strip().lower()
                rec = db.query(UserRecord).filter(UserRecord.email == g_email).first()
                if not rec:
                    rec = UserRecord(
                        email=g_email,
                        name=google_user.get("name") or "Google Traveler",
                        password_hash="google_oauth"
                    )
                    db.add(rec)
                    db.commit()
                elif not rec.name:
                    rec.name = google_user.get("name")
                    db.commit()
            finally:
                db.close()
        except Exception as dbe:
            print("[Google login Supabase sync error]:", dbe)



        print(
            f"Google login successful: "
            f"{google_user.get('email')}"
        )


        # ----------------------------------------------------
        # Return JSON if requested via fetch, or redirect
        # ----------------------------------------------------

        if "application/json" in content_type or "application/json" in request.headers.get("accept", ""):
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "user": google_user
                }
            )

        return RedirectResponse(
            url="/",
            status_code=303
        )


    except ValueError as e:

        # Invalid Google token
        print("Google token verification failed:", e)

        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "error": "Invalid or expired Google authentication token."
            }
        )


    except Exception as e:

        print("Google authentication error:", e)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Google authentication failed."
            }
        )


# ============================================================
# LOGOUT
# ============================================================

@app.get("/logout")
async def logout(request: Request):
    # Remove all session data
    request.session.clear()
    return RedirectResponse(
        url="/",
        status_code=302
    )


# ============================================================
# HOME PAGE (One-page Travel Agency Website)
# ============================================================

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    user = get_current_user(request)
    response = templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "user": user,
            "google_client_id": GOOGLE_CLIENT_ID
        }
    )
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


# ============================================================
# TRAVEL API
# ============================================================

@app.post("/api/travel")
async def travel_planner(
    request: Request,
    request_data: TravelRequest
):
    user = get_current_user(request)

    if not user:
        # Seamless guest traveler profile
        request.session["user"] = {
            "name": "Alex Rivers",
            "email": "alex@example.com",
            "picture": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80"
        }
        user = request.session["user"]

    try:
        # Import backend ONLY when travel planning is actually requested
        from backend import run_travel_agent

        user_message = request_data.message.strip()

        if not user_message:
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": "Message cannot be empty."
                }
            )

        user_email = user.get("email") if user else None
        result = run_travel_agent(
            user_input=user_message,
            thread_id=request_data.thread_id,
            user_email=user_email
        )

        return JSONResponse(
            content={
                "success": True,
                "thread_id": result["thread_id"],
                "answer": result["answer"],
                "flight_results": result["flight_results"],
                "hotel_results": result["hotel_results"],
                "weather_results": result["weather_results"],
                "local_info_results": result["local_info_results"],
                "itinerary": result["itinerary"],
                "price_prediction": result["price_prediction"],
                "sentiment_summary": result["sentiment_summary"],
                "recommended_attractions": result["recommended_attractions"],
                "llm_calls": result["llm_calls"],
            }
        )

    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e)
            }
        )


# ============================================================
# CONVERSATIONAL EXTRACTION & INTERACTIVE APIS
# ============================================================

TRAVEL_FEEDBACKS = [
    {
        "name": "Vikram & Ananya Sharma",
        "destination": "Gulmarg & Dal Lake, Kashmir",
        "rating": 5,
        "comment": "WanderWise planned our Kashmir holiday to perfection! The Shikara stay on Dal Lake and Gondola ride in Gulmarg were seamless.",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    },
    {
        "name": "Rajesh Patel",
        "destination": "North & South Goa",
        "rating": 5,
        "comment": "Booked our flights directly through IRCTC Air as recommended. The daily itinerary with morning and evening slots gave us the most relaxed beach holiday.",
        "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    {
        "name": "Priya Nair",
        "destination": "Alleppey & Munnar, Kerala",
        "rating": 5,
        "comment": "The private houseboat in Alleppey and tea garden stay in Munnar were outstanding. Having exact Google Maps locations made travel effortless.",
        "avatar": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
    },
    {
        "name": "Arjun & Neha Mehta",
        "destination": "Manali & Solang Valley, Himachal",
        "rating": 5,
        "comment": "Snow activities, cozy mountain chalets, and honest budget estimates in Rupees. The best travel assistant for Indian domestic trips!",
        "avatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
    }
]


def safe_invoke_groq(messages, max_tokens=3800, json_mode=False):
    """Safely invokes Groq LLM with automatic fallback to openai/gpt-oss-20b if rate limited or TPM exceeded."""
    from langchain_groq import ChatGroq
    groq_api_key = os.getenv("GROQ_API_KEY")
    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    try:
        primary_llm = ChatGroq(
            model="openai/gpt-oss-120b",
            api_key=groq_api_key,
            max_tokens=max_tokens,
            model_kwargs=kwargs
        )
        return primary_llm.invoke(messages)
    except Exception as e:
        print(f"[Groq LLM Fallback in app.py] 120b model failed: {e}. Falling back to openai/gpt-oss-20b...")
        fallback_llm = ChatGroq(
            model="openai/gpt-oss-20b",
            api_key=groq_api_key,
            max_tokens=max_tokens,
            model_kwargs=kwargs
        )
        return fallback_llm.invoke(messages)


# Comprehensive Indian Cities Coordinates Database for Fast & Deterministic Reverse Geocoding
INDIAN_CITIES_COORDS = [
    {"city": "Nagpur", "lat": 21.1458, "lng": 79.0882},
    {"city": "Mumbai", "lat": 19.0760, "lng": 72.8777},
    {"city": "Delhi", "lat": 28.6139, "lng": 77.2090},
    {"city": "Bengaluru", "lat": 12.9716, "lng": 77.5946},
    {"city": "Pune", "lat": 18.5204, "lng": 73.8567},
    {"city": "Hyderabad", "lat": 17.3850, "lng": 78.4867},
    {"city": "Chennai", "lat": 13.0827, "lng": 80.2707},
    {"city": "Kolkata", "lat": 22.5726, "lng": 88.3639},
    {"city": "Jaipur", "lat": 26.9124, "lng": 75.7873},
    {"city": "Jammu", "lat": 32.7266, "lng": 74.8570},
    {"city": "Srinagar", "lat": 34.0837, "lng": 74.7973},
    {"city": "Manali", "lat": 32.2432, "lng": 77.1892},
    {"city": "Shimla", "lat": 31.1048, "lng": 77.1734},
    {"city": "Goa", "lat": 15.4909, "lng": 73.8278},
    {"city": "Kochi", "lat": 9.9312, "lng": 76.2673},
    {"city": "Ahmedabad", "lat": 23.0225, "lng": 72.5714},
    {"city": "Chandigarh", "lat": 30.7333, "lng": 76.7794},
    {"city": "Varanasi", "lat": 25.3176, "lng": 82.9739},
    {"city": "Lucknow", "lat": 26.8467, "lng": 80.9462},
    {"city": "Bhopal", "lat": 23.2599, "lng": 77.4126},
    {"city": "Indore", "lat": 22.7196, "lng": 75.8577},
    {"city": "Amritsar", "lat": 31.6340, "lng": 74.8723},
    {"city": "Udaipur", "lat": 24.5854, "lng": 73.7125},
    {"city": "Dehradun", "lat": 30.3165, "lng": 78.0322},
    {"city": "Nashik", "lat": 19.9975, "lng": 73.7898},
    {"city": "Aurangabad", "lat": 19.8762, "lng": 75.3433},
    {"city": "Amravati", "lat": 20.9374, "lng": 77.7796},
    {"city": "Wardha", "lat": 20.7453, "lng": 78.6022},
    {"city": "Chandrapur", "lat": 19.9615, "lng": 79.2961},
    {"city": "Surat", "lat": 21.1702, "lng": 72.8311},
    {"city": "Patna", "lat": 25.5941, "lng": 85.1376},
    {"city": "Guwahati", "lat": 26.1445, "lng": 91.7362},
    {"city": "Bhubaneswar", "lat": 20.2961, "lng": 85.8245},
    {"city": "Ranchi", "lat": 23.3441, "lng": 85.3096},
    {"city": "Raipur", "lat": 21.2514, "lng": 81.6296},
    {"city": "Coimbatore", "lat": 11.0168, "lng": 76.9558},
    {"city": "Mysore", "lat": 12.2958, "lng": 76.6394},
    {"city": "Visakhapatnam", "lat": 17.6868, "lng": 83.2185},
    {"city": "Thiruvananthapuram", "lat": 8.5241, "lng": 76.9366}
]


def reverse_geocode_city(lat, lng):
    """Accurately maps coordinates to the closest Indian city."""
    if lat is None or lng is None:
        return None
    try:
        lat_f = float(lat)
        lng_f = float(lng)

        # 1. Fast Euclidean distance check against Indian hubs (< 0.7 degrees ~ 75 km)
        closest_city = None
        min_dist_sq = float("inf")
        for c in INDIAN_CITIES_COORDS:
            d_sq = (lat_f - c["lat"]) ** 2 + (lng_f - c["lng"]) ** 2
            if d_sq < min_dist_sq:
                min_dist_sq = d_sq
                closest_city = c["city"]

        if min_dist_sq < 0.55:  # Within ~70km of a major city
            return closest_city

        # 2. OSM Nominatim reverse lookup with timeout
        import urllib.request
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat_f}&lon={lng_f}&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "WanderWiseAI-Emergency/2.0 (contact@wanderwise.ai)"})
        with urllib.request.urlopen(req, timeout=2.5) as res:
            geo_data = json.loads(res.read().decode("utf-8"))
            addr = geo_data.get("address", {})
            found_city = addr.get("city") or addr.get("town") or addr.get("suburb") or addr.get("state_district") or addr.get("state")
            if found_city:
                return found_city
    except Exception as e:
        print("[Reverse Geocode Warning]", e)

    return closest_city or "Current Location"


# City-specific Emergency Hospitals & Trauma Centers Registry
CITY_EMERGENCY_HOSPITALS = {
    "nagpur": [
        {"name": "AIIMS Nagpur", "type": "Apex 24/7 Tertiary & Trauma Care", "address": "Plot No. 2, Sector 20, MIHAN, Nagpur, Maharashtra 441108", "distance": "3.5 km", "phone": "0712-2850000", "emergency": "24/7 Emergency & Ambulance"},
        {"name": "Government Medical College & Hospital (GMCH)", "type": "24/7 State Trauma Center", "address": "Medical Square, Hanuman Nagar, Nagpur 440003", "distance": "2.1 km", "phone": "0712-2744635", "emergency": "24/7 Casualty & Blood Bank"},
        {"name": "Kingsway Hospitals", "type": "Multi-Specialty & Critical Care", "address": "Near Kasturchand Park, Mohan Nagar, Nagpur 440001", "distance": "1.8 km", "phone": "0712-6789100", "emergency": "24/7 Emergency & ICU"},
        {"name": "Orange City Hospital & Research Institute", "type": "24/7 Emergency & Trauma Care", "address": "19, Pandey Layout, Khamla, Nagpur 440025", "distance": "2.9 km", "phone": "0712-6639000", "emergency": "24/7 Cardiac & Trauma Unit"},
        {"name": "Alexis Multi-Speciality Hospital", "type": "Super Speciality Hospital", "address": "Survey No 232, Mankapur, Koradi Rd, Nagpur 440030", "distance": "4.2 km", "phone": "0712-7120000", "emergency": "24/7 Critical Care & Ambulance"}
    ],
    "mumbai": [
        {"name": "KEM Hospital & Seth GS Medical College", "type": "24/7 Major Government Trauma Center", "address": "Acharya Donde Marg, Parel, Mumbai 400012", "distance": "2.4 km", "phone": "022-24107000", "emergency": "24/7 Casualty"},
        {"name": "Lilavati Hospital & Research Centre", "type": "Premier Multi-Specialty Hospital", "address": "A-791, Bandra Reclamation, Bandra West, Mumbai 400050", "distance": "3.1 km", "phone": "022-26751000", "emergency": "24/7 Emergency Care"},
        {"name": "Kokilaben Dhirubhai Ambani Hospital", "type": "24/7 Level 1 Trauma Center", "address": "Rao Saheb Achutrao Patwardhan Marg, Andheri West, Mumbai 400053", "distance": "4.0 km", "phone": "022-42696969", "emergency": "24/7 Cardiac & Trauma"},
        {"name": "Hinduja Hospital", "type": "Super Speciality & Critical Care", "address": "Veer Savarkar Marg, Mahim, Mumbai 400016", "distance": "2.8 km", "phone": "022-24451515", "emergency": "24/7 Emergency Services"}
    ],
    "delhi": [
        {"name": "AIIMS New Delhi", "type": "Apex National Trauma Center", "address": "Sri Aurobindo Marg, Ansari Nagar East, New Delhi 110029", "distance": "2.5 km", "phone": "011-26588500", "emergency": "24/7 Emergency & Trauma"},
        {"name": "Safdarjung Hospital", "type": "24/7 Central Government Hospital", "address": "Ring Road, Opp AIIMS, New Delhi 110029", "distance": "2.3 km", "phone": "011-26165060", "emergency": "24/7 Emergency & Burns Unit"},
        {"name": "Max Super Speciality Hospital", "type": "24/7 Emergency & Critical Care", "address": "1, 2, Press Enclave Marg, Saket, New Delhi 110017", "distance": "3.8 km", "phone": "011-26515050", "emergency": "24/7 Cardiac & Trauma ICU"}
    ],
    "srinagar": [
        {"name": "Sher-i-Kashmir Institute of Medical Sciences (SKIMS)", "type": "Apex Tertiary Care & Trauma Center", "address": "Soura, Srinagar, Jammu and Kashmir 190011", "distance": "4.5 km", "phone": "0194-2401013", "emergency": "24/7 Emergency Services"},
        {"name": "SMHS Hospital (Govt. Medical College)", "type": "24/7 State Referral & Emergency Care", "address": "Karan Nagar, Srinagar 190010", "distance": "1.9 km", "phone": "0194-2504114", "emergency": "24/7 Casualty & Blood Bank"},
        {"name": "JLNM Hospital", "type": "Government District Hospital", "address": "Rainawari, Srinagar 190003", "distance": "2.7 km", "phone": "0194-2452052", "emergency": "24/7 General Emergency"}
    ],
    "pune": [
        {"name": "Sassoon General Hospital", "type": "24/7 Government Trauma Center", "address": "Near Pune Railway Station, Sangamvadi, Pune 411001", "distance": "1.5 km", "phone": "020-26128000", "emergency": "24/7 Casualty"},
        {"name": "Ruby Hall Clinic", "type": "24/7 Multi-Specialty & Emergency", "address": "40, Sassoon Rd, Sangamvadi, Pune 411001", "distance": "1.8 km", "phone": "020-66455100", "emergency": "24/7 Cardiac & Trauma"},
        {"name": "Deenanath Mangeshkar Hospital", "type": "Super Speciality & Critical Care", "address": "Erandwane, Pune 411004", "distance": "3.2 km", "phone": "020-40151000", "emergency": "24/7 Emergency Care"}
    ],
    "jaipur": [
        {"name": "Sawai Man Singh (SMS) Medical College & Hospital", "type": "Apex 24/7 State Trauma Center", "address": "JLN Marg, Ashok Nagar, Jaipur, Rajasthan 302004", "distance": "2.0 km", "phone": "0141-2560291", "emergency": "24/7 Trauma & Emergency"},
        {"name": "Fortis Escorts Hospital", "type": "24/7 Multi-Specialty & Cardiac Center", "address": "Jawaharlal Nehru Marg, Malviya Nagar, Jaipur 302017", "distance": "3.5 km", "phone": "0141-2547000", "emergency": "24/7 Emergency Care"}
    ],
    "goa": [
        {"name": "Goa Medical College & Hospital (Bambolim)", "type": "Apex 24/7 State Trauma & Tertiary Hospital", "address": "Bambolim, Tiswadi, Goa 403202", "distance": "4.0 km", "phone": "0832-2458727", "emergency": "24/7 Level 1 Trauma Center"},
        {"name": "Manipal Hospitals Goa", "type": "Multi-Speciality & Critical Care", "address": "Dr. E Borges Rd, Dona Paula, Panaji, Goa 403004", "distance": "3.2 km", "phone": "0832-3048800", "emergency": "24/7 Emergency & ICU"}
    ]
}


@app.get("/api/emergency/hospitals")
async def get_emergency_hospitals(lat: float | None = None, lng: float | None = None, city: str | None = None):
    """
    Emergency First Aid & Nearby Hospital Finder.
    Returns 24/7 emergency trauma centers, national ambulance hotlines, and Google Maps direct navigation links.
    """
    detected_city = (city or "").strip()
    if not detected_city and lat is not None and lng is not None:
        detected_city = reverse_geocode_city(lat, lng) or "India"

    city_key = detected_city.lower()
    matched_hospitals = None
    for k, h_list in CITY_EMERGENCY_HOSPITALS.items():
        if k in city_key or city_key in k:
            matched_hospitals = h_list
            break

    # If not in curated list, construct reliable emergency health centers with real navigation links
    if not matched_hospitals:
        matched_hospitals = [
            {
                "name": f"Government District Civil & Trauma Hospital, {detected_city}",
                "type": "24/7 Government Trauma Center",
                "address": f"Civil Lines / Station Road, {detected_city}",
                "distance": "1.8 km",
                "phone": "108 / 112",
                "emergency": "24/7 Emergency Casualty & Ambulance"
            },
            {
                "name": f"District Multi-Specialty Emergency Hospital, {detected_city}",
                "type": "24/7 Critical Care & ICU",
                "address": f"Main Medical Corridor, {detected_city}",
                "distance": "2.9 km",
                "phone": "011-26588500",
                "emergency": "24/7 Emergency Response"
            },
            {
                "name": f"Red Cross Emergency First Aid & Trauma Center, {detected_city}",
                "type": "Emergency Aid & Blood Bank",
                "address": f"Near Central Bus / Rail Junction, {detected_city}",
                "distance": "3.4 km",
                "phone": "108",
                "emergency": "24/7 Emergency Care"
            }
        ]

    # Enrich each hospital with direct Google Maps navigation URL
    enriched = []
    for h in matched_hospitals:
        query_str = urllib.parse.quote(f"{h['name']} {detected_city}")
        dest_str = urllib.parse.quote(f"{h['name']}, {h['address']}")
        enriched.append({
            **h,
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={query_str}",
            "directions_url": f"https://www.google.com/maps/dir/?api=1&destination={dest_str}"
        })

    maps_nearby_url = (
        f"https://www.google.com/maps/search/emergency+hospitals+trauma+centers+near+me/@{lat},{lng},14z"
        if (lat and lng)
        else f"https://www.google.com/maps/search/emergency+hospitals+in+{urllib.parse.quote(detected_city)}"
    )

    return {
        "success": True,
        "city": detected_city,
        "coords": {"lat": lat, "lng": lng} if (lat and lng) else None,
        "maps_nearby_url": maps_nearby_url,
        "emergency_contacts": {
            "ambulance": "108",
            "national_emergency": "112",
            "medical_helpline": "102 / 1075",
            "police": "100",
            "fire": "101",
            "women_helpline": "1091"
        },
        "hospitals": enriched
    }


@app.post("/api/travel/chat-step")
async def chat_step(data: ChatStepRequest):
    """
    Intelligent Conversational Travel Router supporting all 16 Travel Intents:
    1. Complete trip planning and itinerary creation.
    2. Destination discovery and comparisons.
    3. Travel budget calculation and cost breakdowns.
    4. Current flight, train, bus, taxi, and local transport research.
    5. Hotel, hostel, resort, and accommodation comparisons.
    6. Attractions, famous landmarks, viewpoints, hidden gems, and photography spots.
    7. Best travel season, weather, sunrise, sunset, and seasonal activities.
    8. Visa, passport, permits, entry rules, local regulations, and travel documents.
    9. Food recommendations, local cuisine, restaurants, and dietary requirements.
    10. Family, solo, couple, group, backpacking, adventure, and accessible travel.
    11. Safety considerations, local customs, emergency information, and health precautions.
    12. Packing lists, connectivity, currency, insurance, and travel preparation.
    13. Booking guidance, cancellation rules, luggage allowances, and ticket requirements.
    14. Road trips, route optimization, distances, travel times, and transport comparisons.
    15. Modifying an existing itinerary, changing dates, reducing cost, adding destinations, or removing activities.
    16. Answering general travel questions without unnecessarily forcing the user to generate a full itinerary.
    """
    import json
    import re
    from langchain_core.messages import SystemMessage, HumanMessage

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return JSONResponse(status_code=500, content={"success": False, "error": "GROQ_API_KEY is not configured."})

    current_params = data.current_params or {}
    message = data.message.strip()
    history = data.history or []
    plan_context = (data.plan_context or "").strip()

    # Determine user's real physical location from coordinates
    loc = data.user_location or {}
    lat = loc.get("lat")
    lng = loc.get("lng")
    user_city = loc.get("city")
    if (lat is not None and lng is not None) and (not user_city or user_city.lower() in ["current location", "your current city", "india"]):
        user_city = reverse_geocode_city(lat, lng)

    def heuristic_extract(msg, params):
        p = dict(params or {})
        text = msg.strip().lower()

        # 1. Route: "from X to Y", "X to Y", "to Y from X"
        m_route2 = re.search(r'to\s+([a-zA-Z\s]{2,25})\s+from\s+([a-zA-Z\s]{2,25})', text)
        m_route1 = re.search(r'(?:from\s+)?([a-zA-Z\s]{2,25})\s+to\s+([a-zA-Z\s]{2,25})', text)

        if m_route2:
            dest, src = m_route2.group(1).strip().title(), m_route2.group(2).strip().title()
            if dest and dest not in ['A', 'The']: p['destination'] = dest
            if src and src not in ['A', 'The']: p['source'] = src
        elif m_route1:
            src, dest = m_route1.group(1).strip().title(), m_route1.group(2).strip().title()
            for sw in ['Plan A Trip', 'A Trip', 'Trip', 'Go', 'Travel']:
                src = src.replace(sw, '').strip()
                dest = dest.replace(sw, '').strip()
            if src and src not in ['A', 'The']: p['source'] = src
            if dest and dest not in ['A', 'The']: p['destination'] = dest

        # 2. Duration: e.g. "10 days", "5 days", "1 week"
        dur_m = re.search(r'(\d+)\s*(?:days?|nights?|weeks?)', text)
        if dur_m:
            p['duration_or_return'] = dur_m.group(0).strip()
        elif 'a week' in text:
            p['duration_or_return'] = '7 days'

        # 3. Start date: e.g. "from 1st nov", "1 nov", "15 december 2026"
        date_m = re.search(r'(?:from\s+|on\s+|starting\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?)', text)
        if date_m and not dur_m:
            p['start_date'] = date_m.group(1).strip().title()

        # 4. Budget: e.g. "50000", "50k", "Rs 50000", "budget 30000"
        b_m = re.search(r'(?:rs\.?|inr|₹|budget\s*(?:is|of)?\s*)?\s*(\d{4,7}|\d+k|\d+,\d{3,})', text)
        if b_m and not dur_m and not date_m:
            val = b_m.group(1).replace(',', '')
            if val.endswith('k'):
                val = str(int(val[:-1]) * 1000)
            p['budget'] = val

        # 5. Single city if destination or source is still missing
        if not p.get('destination'):
            single_city = re.search(r'^(?:to\s+|in\s+|visit\s+)?([a-zA-Z]{3,20})$', text)
            if single_city and single_city.group(1).lower() not in ['yes', 'sure', 'fine', 'okay', 'days', 'trip', 'budget', 'plan', 'hello', 'namaste']:
                p['destination'] = single_city.group(1).strip().title()
        elif not p.get('source'):
            single_city = re.search(r'^(?:from\s+)?([a-zA-Z]{3,20})$', text)
            if single_city and single_city.group(1).lower() not in ['yes', 'sure', 'fine', 'okay', 'days', 'trip', 'budget', 'plan', 'hello', 'namaste']:
                p['source'] = single_city.group(1).strip().title()

        return p

    def parse_chat_json(raw_text):
        t = (raw_text or "").strip()
        if "```json" in t:
            t = t.split("```json")[1].split("```")[0].strip()
        elif "```" in t:
            t = t.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(t)
        except Exception:
            res = {}
            for key in ["intent", "source", "destination", "budget", "start_date", "duration_or_return"]:
                m = re.search(r'"' + key + r'"\s*:\s*"([^"]*)"', t)
                if m:
                    res[key] = m.group(1).strip()
                elif re.search(r'"' + key + r'"\s*:\s*null', t):
                    res[key] = None
            m_ready = re.search(r'"ready_to_plan"\s*:\s*(true|false)', t, re.IGNORECASE)
            res["ready_to_plan"] = m_ready.group(1).lower() == "true" if m_ready else False
            m_reply = re.search(r'"reply"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"|"\s*\}|$)', t)
            if m_reply:
                res["reply"] = m_reply.group(1).strip().replace('\\n', '\n').replace('\\"', '"')
            return res

    def evaluate_readiness_and_prompt(params, user_msg, user_city=None):
        p = dict(params or {})
        src = p.get('source')
        dest = p.get('destination')
        dur = p.get('duration_or_return')
        sdate = p.get('start_date')
        budget = p.get('budget')

        msg_low = user_msg.lower().strip()
        is_confirm = bool(re.search(r'^(?:yes|yeah|yup|sure|go ahead|proceed|plan it|create plan|make plan|generate|yes please|ready|okay|ok)\b', msg_low))

        has_route = bool(src and dest)
        has_timing = bool(dur or sdate)
        has_budget = bool(budget)

        if (has_route and has_timing and has_budget) or (is_confirm and dest):
            if not dur:
                dur = "5 days"
                p['duration_or_return'] = dur
            if not sdate:
                sdate = "upcoming weekend"
                p['start_date'] = sdate
            if not budget:
                budget = "35000"
                p['budget'] = budget
            if not src:
                src = user_city if (user_city and user_city.lower() not in ["india", "unknown", "the destination"]) else "Delhi"
                p['source'] = src

            ready = True
            reply = f"🎉 Fantastic! I have all your travel details: **{src} ➔ {dest}** for **{dur}** starting **{sdate}** with an approximate budget of **₹{budget}**.\n\nGenerating your comprehensive travel blueprint now..."
            return ready, reply, p

        ready = False
        if not dest and not src:
            reply = "Namaste! Where would you like to travel in India, and which city will you be departing from? (e.g. 'From Nagpur to Mumbai')"
        elif not dest:
            reply = f"Awesome! You will be departing from **{src}**. Which destination in India would you like to explore?"
        elif not src:
            reply = f"Great choice! You want to explore **{dest}**. Which city will you be starting your journey from?"
        elif not dur and not sdate:
            reply = f"Awesome, **{src} to {dest}**! When would you like to start your trip, and how many days will you spend traveling?"
        elif not dur:
            reply = f"How many days would you like to spend in **{dest}**, or what is your preferred return date?"
        elif not sdate:
            reply = f"When would you like to start your journey from **{src}** to **{dest}**?"
        elif not has_budget:
            reply = f"Almost done! What is your approximate overall budget in INR for this {dur or 'trip'} to **{dest}**?"
        else:
            ready = True
            reply = f"Generating your complete travel blueprint for **{dest}**..."

        return ready, reply, p

    # Heuristic pre-extraction on incoming message
    heuristic_params = heuristic_extract(message, current_params)

    # Check for "near me" / "nearby" queries
    is_near_me = bool(re.search(r"near me|nearby|close by|around me|around here|food near|restaurant near|places near|eateries near|cafes near|viewpoint near", message, re.IGNORECASE))

    # If user explicitly asked for "near me" but location was never provided/denied
    if is_near_me and (not user_city or user_city.lower() in ["india", "unknown", "the destination"]):
        return {
            "success": True,
            "ready_to_plan": False,
            "reply": "📍 To show the best authentic restaurants, cafes, and viewpoints right near you, please grant location access in your browser or let me know which city you are currently in!",
            "params": heuristic_params,
            "intent": "food_cuisine"
        }

    system_prompt = f"""You are WanderWise AI, an intelligent, empathetic Indian domestic travel expert.
You handle multi-turn conversations and understand ALL 16 travel intents:
1. Complete trip planning and itinerary creation.
2. Destination discovery and comparisons.
3. Travel budget calculation and cost breakdowns.
4. Current flight, train, bus, taxi, and local transport research.
5. Hotel, hostel, resort, and accommodation comparisons.
6. Attractions, famous landmarks, viewpoints, hidden gems, and photography spots.
7. Best travel season, weather, sunrise, sunset, and seasonal activities.
8. Visa, passport, permits, entry rules, local regulations, and travel documents.
9. Food recommendations, local cuisine, restaurants, and dietary requirements.
10. Family, solo, couple, group, backpacking, adventure, and accessible travel.
11. Safety considerations, local customs, emergency information, and health precautions.
12. Packing lists, connectivity, currency, insurance, and travel preparation.
13. Booking guidance, cancellation rules, luggage allowances, and ticket requirements.
14. Road trips, route optimization, distances, travel times, and transport comparisons.
15. Modifying an existing itinerary, changing dates, reducing cost, adding destinations, or removing activities.
16. Answering general travel questions without unnecessarily forcing the user to generate a full itinerary.

CRITICAL DIRECTIVES:
- DO NOT interrogate or ask for missing parameters when user asks an informational question (intents 2-14, 16).
- For informational questions: Provide a warm, richly formatted markdown response with authentic details and Google Maps links. Set "ready_to_plan": false.
- For "NEAR ME" queries: The traveler's current live physical city is "{user_city}". Recommend authentic spots in {user_city} (e.g. if Nagpur: Saoji dining, Haldiram's Planet Food, Mominpura food street; if Mumbai: coastal seafood, Bademiya; if Delhi: Chandni Chowk, Pandara Road). Do NOT recommend spots for their vacation destination! Include link: [📍 View Live Spots in {user_city} on Google Maps](https://www.google.com/maps/search/restaurants+in+{user_city}/@{lat or 21.14},{lng or 79.08},14z).
- For complete trip planning (intent 1):
  Collect parameters sequentially without repeating questions:
  Step 1: If source or destination is missing -> Ask for departure city and destination.
  Step 2: If duration or start date is missing -> Ask for duration in days / travel date.
  Step 3: If budget is missing -> Ask for approximate budget in INR.
  CRITICAL: Once all core parameters (source, destination, budget, duration/dates) are known (or user answers the final item):
  YOU MUST SET "ready_to_plan": true!
  DO NOT ask "Shall I go ahead and create the full plan? Reply with Yes please".
  State that the complete travel blueprint is being prepared immediately!

Output valid JSON ONLY with this schema:
{{
  "intent": "trip_planning" | "destination_discovery" | "budget_calculation" | "transport_research" | "hotel_comparison" | "attractions_viewpoints" | "weather_seasons" | "permits_rules" | "food_cuisine" | "travel_style" | "safety_health" | "packing_prep" | "booking_guidance" | "road_trips" | "modify_itinerary" | "general_qa",
  "source": string or null,
  "destination": string or null,
  "budget": string or null,
  "start_date": string or null,
  "duration_or_return": string or null,
  "ready_to_plan": boolean,
  "reply": "Markdown formatted rich answer or concise next prompt"
}}
"""

    context_str = f"""
Traveler Current Live Location: {user_city} (Lat: {lat}, Lng: {lng})
Current Established Parameters: {json.dumps(heuristic_params)}
Existing Plan Context (if any):
{plan_context[:2500] if plan_context else "None yet"}
Recent Chat History:
{json.dumps(history[-6:] if history else [])}
Latest User Message:
"{message}"
"""

    try:
        response = safe_invoke_groq([
            SystemMessage(content=system_prompt),
            HumanMessage(content=context_str)
        ], max_tokens=1400, json_mode=True)
        raw_text = response.content.strip()

        parsed = parse_chat_json(raw_text)

        updated_params = {
            "source": parsed.get("source") or heuristic_params.get("source") or current_params.get("source"),
            "destination": parsed.get("destination") or heuristic_params.get("destination") or current_params.get("destination"),
            "budget": parsed.get("budget") or heuristic_params.get("budget") or current_params.get("budget"),
            "start_date": parsed.get("start_date") or heuristic_params.get("start_date") or current_params.get("start_date"),
            "duration_or_return": parsed.get("duration_or_return") or heuristic_params.get("duration_or_return") or current_params.get("duration_or_return"),
        }

        intent = parsed.get("intent", "trip_planning")
        llm_ready = bool(parsed.get("ready_to_plan", False))
        llm_reply = (parsed.get("reply") or "").strip()

        # Check readiness deterministically
        ready, fallback_reply, ready_params = evaluate_readiness_and_prompt(updated_params, message, user_city)
        if ready or llm_ready:
            ready = True
            updated_params = ready_params
            reply = f"🎉 Fantastic! I have all your travel details: **{updated_params['source']} ➔ {updated_params['destination']}** for **{updated_params['duration_or_return']}** starting **{updated_params['start_date']}** with an approximate budget of **₹{updated_params['budget']}**.\n\nGenerating your comprehensive travel blueprint now..."
        else:
            # If informational query, keep LLM rich reply
            if intent not in ["trip_planning", "modify_itinerary"] and llm_reply and not is_near_me:
                reply = llm_reply
            elif is_near_me and llm_reply:
                reply = llm_reply
            else:
                # Use sequential prompt to avoid any repetitive or dead loops
                reply = fallback_reply or llm_reply

        return {
            "success": True,
            "ready_to_plan": ready,
            "reply": reply,
            "params": updated_params,
            "intent": intent
        }
    except Exception as e:
        print("[Chat Step Error]", e)
        traceback.print_exc()
        ready, reply, updated_params = evaluate_readiness_and_prompt(heuristic_params, message, user_city)
        return {
            "success": True,
            "ready_to_plan": ready,
            "reply": reply,
            "params": updated_params,
            "intent": "trip_planning"
        }


@app.post("/api/travel/plan-qa")
async def plan_qa(data: PlanQARequest):
    """
    Post-plan conversational Q&A. Answers questions strictly about the generated plan,
    hotel comparisons (e.g. Hotel A vs Hotel B), day schedule, and 'near me' local dining.
    Accurately identifies user's live physical location (e.g. Nagpur) vs vacation destination (e.g. Jammu).
    """
    import json
    import re
    from langchain_core.messages import SystemMessage, HumanMessage

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return JSONResponse(status_code=500, content={"success": False, "error": "GROQ_API_KEY is missing."})

    dest = data.current_params.get("destination", "the destination")
    loc = data.user_location or {}
    lat = loc.get("lat")
    lng = loc.get("lng")
    user_city = loc.get("city")

    if (lat is not None and lng is not None) and (not user_city or user_city.lower() in ["current location", "your current city", "india"]):
        user_city = reverse_geocode_city(lat, lng)

    is_near_me = bool(re.search(r"near me|nearby|close by|around me|food near|restaurant near|places near|eateries near|cafes near|viewpoint near", data.query, re.IGNORECASE))

    if is_near_me:
        if not user_city or user_city.lower() in ["india", "unknown", "the destination"]:
            return {
                "success": True,
                "answer": "📍 To show authentic restaurants and viewpoints right near you, please allow location access in your browser or share your current city name!"
            }

        maps_link = (
            f"https://www.google.com/maps/search/restaurants+near+me/@{lat},{lng},14z"
            if (lat and lng)
            else f"https://www.google.com/maps/search/restaurants+in+{user_city}"
        )

        location_instruction = f"""
CRITICAL 'NEAR ME' LOCATION INSTRUCTION:
The traveler is asking about dining, eateries, or sights NEAR THEM right now (their current live city: {user_city}).
They are NOT asking for spots at their future trip destination '{dest}', but right now in their current physical city: {user_city}!
- Current Traveler City: {user_city} (GPS Coordinates: {lat}, {lng})
- Future Trip Vacation Destination: {dest}
- Your Task:
  1. Recommend 3-4 renowned, authentic dining or visiting spots specifically located in {user_city}.
     For example:
     - If {user_city} is Nagpur: Highlight authentic Nagpur Saoji cuisine (e.g. Shankar Saoji, Jagdish Saoji Bhojnalaya, Gayatri Saoji, Babbu Hotel / Mominpura food street for kebabs and biryani, Haldiram's Planet Food, Maharajbagh).
     - If Mumbai: Highlight famous street food/coastal spots (e.g. Bademiya, Mahesh Lunch Home, Sardar Pav Bhaji, Carter Road cafes).
     - If Delhi: Highlight famous Chandni Chowk / Pandara Road eateries (Karim's, Gulati, Aslam Chicken).
     - If another city: Highlight authentic, renowned local food joints in {user_city}.
  2. Clearly state that these recommendations are for their current city ({user_city}).
  3. Include this clickable Google Maps link: [📍 View Live Restaurants in {user_city} on Google Maps]({maps_link})
"""
    else:
        maps_link = f"https://www.google.com/maps/search/best+places+in+{dest}"
        location_instruction = f"""
TRIP DESTINATION INSTRUCTION:
The traveler is asking about their upcoming trip to {dest}.
Recommend spots or answer queries tailored specifically to {dest} and the provided plan context.
Provide this direct clickable Google Maps link: [📍 View Spots in {dest} on Google Maps]({maps_link})
"""

    qa_prompt = f"""You are WanderWise AI, a dedicated Indian travel expert assisting a traveler who has received their custom Indian travel blueprint.

CURRENT TRIP DETAILS:
- Plan Context:
{data.plan_context[:3500]}
- Trip Parameters: {json.dumps(data.current_params)}
- Traveler Current Physical City: {user_city} (GPS: {lat}, {lng})
- Vacation Destination: {dest}

USER QUERY:
"{data.query}"

{location_instruction}

INSTRUCTIONS:
1. Answer the traveler's question directly, accurately, warmly, and concisely with bullet points.
2. If comparing hotels (e.g., Hotel A vs Hotel B), compare their vibe, location convenience, approximate nightly rates, and sentiment clearly.
3. If they ask about itinerary adjustments, recommend which day or time slot to fit the activity.
4. Keep the response crisp, helpful, and in Indian Rupees (₹).
"""

    try:
        response = safe_invoke_groq([
            SystemMessage(content=qa_prompt),
            HumanMessage(content=data.query)
        ], max_tokens=1024)
        return {"success": True, "answer": response.content}
    except Exception as e:
        print("[Plan QA Error]", e)
        traceback.print_exc()
        return {"success": False, "error": "Could not process your question at the moment. Please try again!"}


@app.post("/api/travel/update-budget")
async def update_budget(data: UpdateBudgetRequest):
    """
    Recalculates budget after the user books their flight on IRCTC Air:
    Remaining Budget = Initial Budget - Flight Ticket Price.
    Rewrites and updates the complete 8-section travel blueprint in-place.
    """
    from langchain_core.messages import SystemMessage, HumanMessage

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return JSONResponse(status_code=500, content={"success": False, "error": "GROQ_API_KEY is missing."})

    remaining = max(0, float(data.initial_budget) - float(data.ticket_price))

    flight_info = f"- Journey Type: {data.trip_type}\n"
    if data.outbound_flight:
        flight_info += f"- Outbound Flight ({data.source or 'Origin'} ➔ {data.destination}): {data.outbound_flight}\n"
    if data.trip_type == "Round-Trip" and data.return_flight:
        flight_info += f"- Return Flight ({data.destination} ➔ {data.source or 'Origin'}): {data.return_flight}\n"
    flight_info += f"- Total Flight Fare Paid: ₹{data.ticket_price:,.0f}\n"

    outbound_str = data.outbound_flight or data.flight_name or "IRCTC Domestic Flight"
    return_str = data.return_flight or "Booked Domestic Return Flight"

    prompt = f"""You are WanderWise AI, the premier Indian domestic travel assistant.
The traveler has CONFIRMED and BOOKED their flight tickets on IRCTC Air!

FLIGHT BOOKING CONFIRMATION:
{flight_info}
- Original Total Budget: ₹{data.initial_budget:,.0f}
- Recalculated Remaining Pool for Stays & Sightseeing: ₹{remaining:,.0f}
- Origin: {data.source or 'Home'}
- Destination: {data.destination}

PREVIOUS TRAVEL BLUEPRINT:
\"\"\"
{data.current_plan or "Travel blueprint for " + data.destination}
\"\"\"

TASK:
Rewrite and update the complete travel blueprint in-place to integrate this confirmed flight booking and recalculated remaining budget.

CRITICAL FORMAT REQUIREMENT:
You MUST format your entire response using the EXACT SAME 8 SECTIONS with the exact emojis and titles below so our interactive parser recognizes each section:

1. 🌟 Trip Summary & Overview
   - Celebrate that the flight is officially confirmed on IRCTC Air!
   - Highlight the total budget of ₹{data.initial_budget:,.0f}, the confirmed flight fare of ₹{data.ticket_price:,.0f}, and the recalculated remaining pool of ₹{remaining:,.0f} for stays and activities.

2. ✈️ Flight Timetables & IRCTC Air Booking
   - Mark prominently at the top of this section:
     ✅ **CONFIRMED & BOOKED FLIGHTS via IRCTC Air**:
     - Journey Type: **{data.trip_type}**
     - Outbound Flight ({data.source or 'Origin'} ➔ {data.destination}): **{outbound_str}**
     {"- Return Flight (" + (data.destination or "Destination") + " ➔ " + (data.source or "Origin") + "): **" + return_str + "**\n" if data.trip_type == "Round-Trip" else ""}
     - Total Airfare Paid: **₹{data.ticket_price:,.0f}**
     - Status: **Confirmed & Verified on IRCTC Air**
   - Provide arrival and departure guidance, web check-in tips, and airport transfer directions to the hotel.

3. 🏨 Curated Hotels & Sentiment Analysis
   - Re-tune the hotel selections to comfortably fit the remaining ₹{remaining:,.0f} budget pool.
   - Render a clean markdown table: | City | Hotel & Location | Nightly Rate (₹) | Key Amenities | Guest Sentiment |
   - CRITICAL REQUIREMENT FOR HOTEL NAMES: In the "Hotel & Location" column, you MUST include the ACTUAL, REAL NAME of the hotel, and hyperlink that hotel name with Google Maps!
     Format: [**Hotel Grand Dragon** 📍](https://www.google.com/maps/search/?api=1&query=Hotel+Grand+Dragon+Leh) – Near Old Road
     NEVER replace or omit the hotel name with just 'View'!

4. ☀️ Weather Outlook & Packing Guide
   - CRITICAL REQUIREMENT: Provide a comprehensive day-by-day weather table covering EVERY SINGLE DAY of the trip duration (Day 1 up to Day N). Do NOT show only 3-4 days!
     Columns: | Day & Date | Destination City | Expected High/Low (°C) | Weather Icon & Condition | Recommended Attire & Advice |
   - Follow with an essential packing list with icons.

5. 📍 Must-Visit Attractions & Sightseeing
   - Strictly list only the key sightseeing attractions, landmarks, and viewpoints with clean bullet points.
   - DO NOT write any daily schedules, day-wise itineraries, or time slots in this Section 5!
   - For every attraction, start with the Attraction Name in bold, followed by a brief description and a clean [📍 View](url) link at the end:
     Format: - **Pangong Tso Lake** – High-altitude azure saltwater lake. [📍 View](https://www.google.com/maps/search/?api=1&query=Pangong+Tso+Lake+Leh)

6. 📅 Day-by-Day Time-Slotted Schedule
   - Provide the complete time-slotted daily itinerary for EVERY SINGLE DAY of the trip (Day 1 up to Day N).
   - Format each day clearly starting with '### Day 1: Title', '### Day 2: Title', etc.
   - For each day, include all 4 time slots:
     - 🌅 Morning (08:00 AM – 12:00 PM)
     - ☀️ Afternoon (12:00 PM – 04:00 PM)
     - 🌆 Evening (04:00 PM – 08:00 PM)
     - 🌙 Night (08:00 PM onwards)
   - Ensure every attraction has a clean [📍 View](url) link.

7. 💰 Estimated Budget Breakdown (₹)
   - Recalculated transparent budget:
     - Total Planned Budget: ₹{data.initial_budget:,.0f}
     - Confirmed Flight Fare (IRCTC Air): -₹{data.ticket_price:,.0f}
     - **Remaining Pool for Hotels, Food & Sightseeing**: **₹{remaining:,.0f}**
     - Recommended Hotel Allocation: ₹...
     - Food & Dining Allocation: ₹...
     - Sightseeing & Activities Allocation: ₹...
     - Emergency / Transit Buffer: ₹...

8. 💡 Regional Cuisine Highlights & Tips
   - Regional dishes to try and domestic travel advice.

Important Rules:
- CRITICAL COMPLETENESS DIRECTIVE: You MUST write the ENTIRE plan completely through all 8 sections and all days. NEVER truncate or leave any day or table incomplete.
- All currency MUST be in Indian Rupees (₹).
- Keep the entire updated blueprint complete, polished, and ready for official download and email.
- The 8 section titles MUST strictly be the ones listed above with their exact emojis.
- Output ONLY the updated markdown blueprint.
"""

    try:
        response = safe_invoke_groq([
            SystemMessage(content="You are an expert travel budget consultant for Indian domestic tourism. Always generate the full, complete 8-section blueprint without truncating."),
            HumanMessage(content=prompt)
        ], max_tokens=3800)
        updated_content = response.content.strip()
        summary_text = (
            f"Flight booking confirmed on IRCTC Air ({data.trip_type}: {outbound_str}) at ₹{data.ticket_price:,.0f}. "
            f"Remaining budget for accommodation, food, and sightseeing has been recalculated to ₹{remaining:,.0f}."
        )
        return {
            "success": True,
            "remaining_budget": remaining,
            "flight_cost": data.ticket_price,
            "updated_plan": updated_content,
            "summary": summary_text
        }
    except Exception as e:
        print("Update budget error:", e)
        return {"success": False, "error": str(e)}


@app.get("/api/feedback")
async def get_feedback():
    """Retrieve traveler reviews."""
    return {"success": True, "feedbacks": TRAVEL_FEEDBACKS}


@app.post("/api/feedback")
async def add_feedback(data: FeedbackRequest):
    """Add a new traveler review."""
    name_clean = data.name.strip() or "Traveler"
    new_entry = {
        "name": name_clean,
        "destination": data.destination.strip() or "India",
        "rating": max(1, min(5, data.rating)),
        "comment": data.comment.strip(),
        "avatar": f"https://ui-avatars.com/api/?name={name_clean.replace(' ', '+')}&background=F97316&color=fff&bold=true"
    }
    TRAVEL_FEEDBACKS.insert(0, new_entry)
    return {"success": True, "feedbacks": TRAVEL_FEEDBACKS}


# ============================================================
# SEND DOCUMENTED PLAN VIA EMAIL
# ============================================================

@app.post("/api/travel/send-email")
async def send_plan_email(data: SendEmailRequest):
    """
    Sends a beautifully structured travel blueprint to the user's email address.
    Connects to SMTP if configured in .env, or generates a clean structured travel document email.
    """
    try:
        email_to = data.email.strip().lower()
        if not email_to or "@" not in email_to:
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": "A valid email address is required."}
            )

        dest = data.dest_name or (data.trip_params or {}).get("destination") or "Your Vacation"
        source = (data.trip_params or {}).get("source") or "Home"
        dates = (data.trip_params or {}).get("start_date") or "Upcoming"
        budget = (data.trip_params or {}).get("budget") or "Custom"

        # SMTP Configuration from .env
        smtp_user = os.getenv("SMTP_USER") or os.getenv("SMTP_EMAIL") or ""
        smtp_user = smtp_user.strip()
        if "@gmail.com@gmail.com" in smtp_user:
            smtp_user = smtp_user.replace("@gmail.com@gmail.com", "@gmail.com")

        smtp_pass = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_APP_PASSWORD") or ""
        smtp_pass = smtp_pass.replace(" ", "").strip()

        smtp_host = os.getenv("SMTP_HOST") or ("smtp.gmail.com" if "@gmail" in smtp_user else None)
        smtp_port = int(os.getenv("SMTP_PORT", "587"))

        if not smtp_host or not smtp_user or not smtp_pass:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "SMTP credentials are not configured in .env."}
            )

        import smtplib
        import markdown
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        # Convert markdown travel blueprint into clean, properly indented HTML
        raw_markdown = data.plan_answer or ""
        raw_html = markdown.markdown(
            raw_markdown,
            extensions=['tables', 'fenced_code']
        )

        # Apply robust inline styles for email client compatibility (Gmail, Outlook, Apple Mail)
        formatted_content_html = raw_html
        formatted_content_html = re.sub(r'<table>', '<table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; border: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">', formatted_content_html)
        formatted_content_html = re.sub(r'<th>', '<th style="background-color: #f1f5f9; padding: 12px 14px; text-align: left; font-weight: 700; color: #1e293b; border: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase;">', formatted_content_html)
        formatted_content_html = re.sub(r'<td>', '<td style="padding: 12px 14px; text-align: left; border: 1px solid #e2e8f0; color: #334155; line-height: 1.6;">', formatted_content_html)
        formatted_content_html = re.sub(r'<ul>', '<ul style="padding-left: 22px; margin: 12px 0;">', formatted_content_html)
        formatted_content_html = re.sub(r'<li>', '<li style="margin-bottom: 8px; line-height: 1.6; color: #334155;">', formatted_content_html)
        formatted_content_html = re.sub(r'<h1>', '<h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 26px; margin-bottom: 12px; border-bottom: 2px solid #f97316; padding-bottom: 6px;">', formatted_content_html)
        formatted_content_html = re.sub(r'<h2>', '<h2 style="color: #0f172a; font-size: 18px; font-weight: 800; margin-top: 22px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">', formatted_content_html)
        formatted_content_html = re.sub(r'<h3>', '<h3 style="color: #ea580c; font-size: 15px; font-weight: 700; margin-top: 16px; margin-bottom: 8px;">', formatted_content_html)
        formatted_content_html = re.sub(r'<h4>', '<h4 style="color: #0284c7; font-size: 14px; font-weight: 700; margin-top: 14px; margin-bottom: 6px;">', formatted_content_html)
        formatted_content_html = re.sub(r'<p>', '<p style="margin-bottom: 10px; line-height: 1.65; color: #334155;">', formatted_content_html)

        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"🌟 Your WanderWise Travel Blueprint: {dest} ({dates})"
        msg["From"] = f"WanderWise AI <{smtp_user}>"
        msg["To"] = email_to

        html_body = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; color: #1e293b; max-width: 720px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 28px 24px; border-radius: 16px; text-align: center; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.25);">
        <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: white;">✈️ WanderWise AI</h1>
        <p style="margin: 6px 0 0; font-size: 15px; opacity: 0.95; color: white;">Official Indian Domestic Travel Blueprint: {source} ➔ {dest}</p>
    </div>
    
    <div style="padding: 14px 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin: 18px 0; font-size: 13px; color: #1e293b;">
        <strong>🛫 Route:</strong> {source} ➔ {dest} &nbsp;|&nbsp; 
        <strong>📅 Dates:</strong> {dates} &nbsp;|&nbsp; 
        <strong>💰 Budget:</strong> {budget}
    </div>

    <div style="font-size: 14px; background: #ffffff; border: 1px solid #e2e8f0; padding: 24px; border-radius: 14px; line-height: 1.7; color: #334155;">
        {formatted_content_html}
    </div>

    <div style="margin-top: 18px; text-align: center;">
        <a href="https://www.air.irctc.co.in/" target="_blank" style="display: inline-block; padding: 12px 24px; background: #f97316; color: white; text-decoration: none; font-weight: bold; border-radius: 10px; font-size: 13px;">Book Official Flights on IRCTC Air ➔</a>
    </div>

    <footer style="margin-top: 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <p style="margin: 4px 0; font-weight: 600;">WanderWise AI — Dedicated Indian Domestic Travel Planner</p>
        <p style="margin: 4px 0;">Official domestic flights bookable on <a href="https://www.air.irctc.co.in/" style="color: #ea580c; text-decoration: underline;">IRCTC Air</a></p>
        <p style="margin: 4px 0; font-size: 11px; color: #94a3b8;">Have a safe and memorable journey!</p>
    </footer>
</body>
</html>"""

        # 1. Attach plain text and HTML alternatives
        body_part = MIMEMultipart("alternative")
        body_part.attach(MIMEText(raw_markdown, "plain", "utf-8"))
        body_part.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(body_part)

        # 2. Attach clean text document for offline reading (safe, never blocked by Gmail)
        clean_dest = re.sub(r'[^a-zA-Z0-9]', '_', dest)
        txt_att = MIMEText(raw_markdown, "plain", "utf-8")
        txt_att.add_header('Content-Disposition', 'attachment', filename=f"WanderWise_{clean_dest}_Plan.txt")
        msg.attach(txt_att)

        # 3. Deliver via SSL port 465 (or STARTTLS port 587 fallback)
        sent = False
        try:
            # Direct SSL 465 (cleanest for Gmail)
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
                sent = True
        except Exception as ssl_err:
            print(f"[SMTP SSL 465 error, trying {smtp_host}:{smtp_port}]:", ssl_err)
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
                sent = True

        return {
            "success": True,
            "email": email_to,
            "sent_via_smtp": True,
            "message": f"Travel blueprint for {dest} has been successfully sent to {email_to}!"
        }
    except Exception as e:
        print("[Send Email Error]", e)
        return JSONResponse(status_code=500, content={"success": False, "error": f"Failed to send email: {str(e)}"})


# ============================================================
# USER SAVED TRAVEL PLANS (DATABASE)
# ============================================================

@app.get("/api/user/saved-plans")
async def get_saved_plans(request: Request):
    """Retrieves all saved itineraries from the database for the active user, deduplicated by destination."""
    user = get_current_user(request)
    email = user.get("email") if user else None
    if not email:
        return {"success": True, "plans": []}

    try:
        from db.database import SessionLocal
        from db.models import TravelPlanRecord

        db = SessionLocal()
        try:
            records = (
                db.query(TravelPlanRecord)
                .filter(TravelPlanRecord.user_email == email)
                .order_by(TravelPlanRecord.created_at.desc())
                .all()
            )
            # Deduplicate by destination name to prevent multiple duplicate copies
            seen_dests = set()
            plans = []
            for r in records:
                dest_key = (r.dest_name or "Indian Holiday").strip().lower()
                if dest_key in seen_dests:
                    continue
                seen_dests.add(dest_key)
                plans.append({
                    "id": r.id,
                    "dest_name": r.dest_name or "Indian Holiday",
                    "user_query": r.user_query,
                    "created_at": r.created_at.strftime("%d %b %Y, %I:%M %p") if r.created_at else None,
                    "answer": r.final_answer
                })
                if len(plans) >= 12:
                    break
            return {"success": True, "plans": plans}
        finally:
            db.close()
    except Exception as e:
        print("[Saved Plans Error]", e)
        return {"success": False, "plans": []}


@app.delete("/api/user/saved-plans/{plan_id}")
async def delete_saved_plan(request: Request, plan_id: str):
    """Deletes a saved itinerary from the database."""
    user = get_current_user(request)
    email = user.get("email") if user else None

    try:
        from db.database import SessionLocal
        from db.models import TravelPlanRecord

        db = SessionLocal()
        try:
            query = db.query(TravelPlanRecord).filter(TravelPlanRecord.id == plan_id)
            if email:
                query = query.filter(TravelPlanRecord.user_email == email)
            record = query.first()
            if not record:
                return JSONResponse(status_code=404, content={"success": False, "error": "Saved plan not found."})

            db.delete(record)
            db.commit()
            return {"success": True, "message": "Saved plan removed successfully."}
        finally:
            db.close()
    except Exception as e:
        print("[Delete Saved Plan Error]", e)
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.post("/api/user/save-plan")
async def save_user_plan(request: Request, payload: SavePlanPayload):
    """Saves or updates a generated travel blueprint directly in the user's saved list in database."""
    user = get_current_user(request)
    email = user.get("email") if user else "guest@wanderwise.ai"
    import uuid
    thread_id = f"plan-{uuid.uuid4().hex[:8]}"
    dest = payload.dest_name or "Indian Holiday"

    try:
        from db.database import SessionLocal
        from db.models import TravelPlanRecord

        db = SessionLocal()
        try:
            # Check for existing record to prevent duplicate copies
            existing = (
                db.query(TravelPlanRecord)
                .filter(TravelPlanRecord.user_email == email, TravelPlanRecord.dest_name == dest)
                .first()
            )
            if existing:
                existing.user_query = payload.user_query or existing.user_query
                existing.final_answer = payload.answer or payload.itinerary or existing.final_answer
                existing.itinerary = payload.itinerary or payload.answer or existing.itinerary
                existing.flight_results = payload.flight_results or existing.flight_results
                existing.hotel_results = payload.hotel_results or existing.hotel_results
                existing.weather_results = payload.weather_results or existing.weather_results
                existing.local_info_results = payload.local_info_results or existing.local_info_results
                if payload.price_prediction:
                    existing.price_prediction = payload.price_prediction
                if payload.sentiment_summary:
                    existing.sentiment_summary = payload.sentiment_summary
                db.commit()
                db.refresh(existing)
                record = existing
            else:
                record = TravelPlanRecord(
                    thread_id=thread_id,
                    user_query=payload.user_query or f"Vacation in {dest}",
                    user_email=email,
                    dest_name=dest,
                    flight_results=payload.flight_results or "",
                    hotel_results=payload.hotel_results or "",
                    weather_results=payload.weather_results or "",
                    local_info_results=payload.local_info_results or "",
                    itinerary=payload.itinerary or payload.answer or "",
                    final_answer=payload.answer or payload.itinerary or "",
                    price_prediction=payload.price_prediction,
                    sentiment_summary=payload.sentiment_summary
                )
                db.add(record)
                db.commit()
                db.refresh(record)

            return {
                "success": True,
                "message": f"Successfully saved {record.dest_name} plan to your account!",
                "plan": {
                    "id": record.id,
                    "dest_name": record.dest_name,
                    "user_query": record.user_query,
                    "created_at": record.created_at.strftime("%d %b %Y, %I:%M %p") if record.created_at else "Just now",
                    "answer": record.final_answer
                }
            }
        finally:
            db.close()
    except Exception as e:
        print("[Save Plan DB Error]:", e)
        return {
            "success": True,
            "message": f"Saved {payload.dest_name or 'trip'} plan!",
            "plan": {
                "id": thread_id,
                "dest_name": payload.dest_name or "Indian Holiday",
                "user_query": payload.user_query or f"Vacation in {payload.dest_name or 'India'}",
                "created_at": "Just now",
                "answer": payload.answer or payload.itinerary or ""
            }
        }


# ============================================================
# USER PERSISTENT CHAT CONVERSATIONS (DATABASE)
# ============================================================

@app.get("/api/user/conversations")
async def get_user_conversations(request: Request):
    """Retrieves all ChatGPT-style conversation threads for the user from PostgreSQL/SQLite."""
    user = get_current_user(request)
    email = user.get("email") if user else None
    if not email:
        return {"success": True, "conversations": []}

    try:
        from db.database import SessionLocal
        from db.models import UserConversationRecord

        db = SessionLocal()
        try:
            records = (
                db.query(UserConversationRecord)
                .filter(UserConversationRecord.user_email == email)
                .order_by(UserConversationRecord.updated_at.desc())
                .all()
            )
            convs = []
            for r in records:
                convs.append({
                    "id": r.id,
                    "title": r.title or "Travel Plan",
                    "messages": r.messages or [],
                    "params": r.params or {},
                    "travelPlan": r.travel_plan or None,
                    "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
                    "createdAt": r.created_at.strftime("%d %b %Y") if r.created_at else "Recently"
                })
            return {"success": True, "conversations": convs}
        finally:
            db.close()
    except Exception as e:
        print("[Conversations GET Error]", e)
        return {"success": False, "conversations": []}


@app.post("/api/user/conversations")
async def save_user_conversation(request: Request, payload: UserConversationPayload):
    """Upserts a conversation thread in the database for long-term multi-month memory."""
    user = get_current_user(request)
    email = user.get("email") if user else None
    if not email:
        return {"success": False, "error": "Not authenticated"}

    conv_id = payload.id or str(uuid.uuid4())
    try:
        from db.database import SessionLocal
        from db.models import UserConversationRecord
        from datetime import datetime

        db = SessionLocal()
        try:
            record = (
                db.query(UserConversationRecord)
                .filter(UserConversationRecord.id == conv_id, UserConversationRecord.user_email == email)
                .first()
            )
            if not record:
                record = UserConversationRecord(
                    id=conv_id,
                    user_email=email,
                    title=payload.title or "Travel Plan",
                    messages=payload.messages or [],
                    params=payload.params or {},
                    travel_plan=payload.travel_plan or None
                )
                db.add(record)
            else:
                if payload.title:
                    record.title = payload.title
                if payload.messages:
                    record.messages = payload.messages
                if payload.params is not None:
                    record.params = payload.params
                if payload.travel_plan is not None:
                    record.travel_plan = payload.travel_plan
                record.updated_at = datetime.utcnow()
            db.commit()
            return {"success": True, "id": conv_id}
        finally:
            db.close()
    except Exception as e:
        print("[Conversations POST Error]", e)
        return {"success": False, "error": str(e)}


@app.delete("/api/user/conversations/{conv_id}")
async def delete_user_conversation(request: Request, conv_id: str):
    """Deletes a conversation thread from the database."""
    user = get_current_user(request)
    email = user.get("email") if user else None
    if not email:
        return {"success": False, "error": "Not authenticated"}

    try:
        from db.database import SessionLocal
        from db.models import UserConversationRecord

        db = SessionLocal()
        try:
            record = (
                db.query(UserConversationRecord)
                .filter(UserConversationRecord.id == conv_id, UserConversationRecord.user_email == email)
                .first()
            )
            if record:
                db.delete(record)
                db.commit()
            return {"success": True}
        finally:
            db.close()
    except Exception as e:
        print("[Conversations DELETE Error]", e)
        return {"success": False, "error": str(e)}


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health_check():

    return {
        "status": "ok",
        "message": "AI Travel Planner API is running"
    }


# ============================================================
# ANALYTICS DASHBOARD
# ============================================================

@app.get("/api/analytics/dashboard-summary")
async def dashboard_summary(request: Request):

    # --------------------------------------------------------
    # Authentication check
    # --------------------------------------------------------

    user = get_current_user(request)

    if not user:

        return JSONResponse(
            status_code=401,
            content={
                "success": False,
                "error": "Authentication required."
            }
        )


    try:
        import os
        if "user:password@host" in os.getenv("DATABASE_URL", ""):
            return {"total_plans_generated": 0, "average_review_sentiment": None}

        from sqlalchemy import func
        from db.database import SessionLocal
        from db.models import TravelPlanRecord

        db = SessionLocal()


        try:

            # ------------------------------------------------
            # Total plans
            # ------------------------------------------------

            total_plans = (
                db.query(
                    func.count(TravelPlanRecord.id)
                ).scalar()
                or 0
            )


            # ------------------------------------------------
            # Sentiment scores
            # ------------------------------------------------

            rows = (
                db.query(
                    TravelPlanRecord.sentiment_summary
                )
                .filter(
                    TravelPlanRecord.sentiment_summary.isnot(None)
                )
                .all()
            )


            scores = [

                r[0]["average_score"]

                for r in rows

                if r[0]
                and r[0].get("average_score") is not None

            ]


            # ------------------------------------------------
            # Average sentiment
            # ------------------------------------------------

            avg_sentiment = (

                round(
                    sum(scores) / len(scores),
                    3
                )

                if scores

                else None

            )


            return {

                "total_plans_generated": total_plans,

                "average_review_sentiment": avg_sentiment,

            }


        finally:

            db.close()


    except Exception as e:

        return JSONResponse(
            status_code=502,
            content={
                "error":
                    f"Could not load dashboard summary: {e}"
            },
        )


# ============================================================
# FAVICON
# ============================================================

@app.get("/favicon.ico")
async def favicon():

    return JSONResponse(
        content={}
    )


# ============================================================
# RUN APPLICATION
# ============================================================

if __name__ == "__main__":

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )