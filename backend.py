import os
import certifi
from dotenv import load_dotenv

load_dotenv()

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

from typing import TypedDict, Annotated, Optional
import operator
import uuid

import psycopg
from psycopg.rows import dict_row

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
)
from langchain_groq import ChatGroq
from tools.tavily_tool import tavily_search
from tools.flight_tool import search_flights
from tools.weather_tool import get_weather_forecast
from tools.local_info_tool import get_local_attractions, get_attractions_structured
from tools.location_resolver import resolve_trip_locations
from analytics.price_prediction import price_predictor
from analytics.sentiment_analysis import sentiment_analyzer
from analytics.recommendation_engine import rank_attractions


def get_database_url():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError(
            "DATABASE_URL is missing. Please add your PostgreSQL Database URL to .env"
        )

    # Sanitize password with unescaped '@' if raw string was provided
    base_part = database_url.split("?")[0]
    query_part = "?" + database_url.split("?")[1] if "?" in database_url else ""
    if base_part.count("@") > 1:
        scheme, rest = base_part.split("://", 1)
        last_at = rest.rfind("@")
        userinfo = rest[:last_at]
        hostpart = rest[last_at + 1:]
        if ":" in userinfo:
            user, pwd = userinfo.split(":", 1)
            pwd = pwd.replace("@", "%40")
            base_part = f"{scheme}://{user}:{pwd}@{hostpart}"
        database_url = base_part + query_part

    if "sslmode=" not in database_url:
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"

    return database_url


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing. Please add it to your .env file.")


# =========================
# LLM
# =========================

def safe_llm_invoke(messages, max_tokens=3800):
    """Safely invokes Groq LLM with automatic fallback to openai/gpt-oss-20b if rate limited or TPM exceeded."""
    try:
        primary_llm = ChatGroq(
            model="openai/gpt-oss-120b",
            api_key=GROQ_API_KEY,
            max_tokens=max_tokens
        )
        return primary_llm.invoke(messages)
    except Exception as e:
        print(f"[Groq LLM Fallback] 120b model encountered: {e}. Falling back to openai/gpt-oss-20b...")
        fallback_llm = ChatGroq(
            model="openai/gpt-oss-20b",
            api_key=GROQ_API_KEY,
            max_tokens=max_tokens
        )
        return fallback_llm.invoke(messages)

llm = ChatGroq(
    model="openai/gpt-oss-120b",
    api_key=GROQ_API_KEY,
    max_tokens=3800
)


# =========================
# State
# =========================
#
# ADDED vs. the original: weather_results, local_info_results,
# price_prediction, sentiment_summary, recommended_attractions.
#
# `llm_calls` changed to an Annotated int with operator.add: now that
# flight/hotel/weather/local_info agents run in the SAME superstep
# (parallel fan-out from START), LangGraph requires a reducer for any
# key more than one node writes concurrently — without one it raises
# an INVALID_CONCURRENT_GRAPH_UPDATE error. Each node now returns a
# delta (1) instead of `state.get("llm_calls", 0) + 1`, and the
# reducer sums them.

class TravelState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    user_query: str
    flight_results: str
    hotel_results: str
    weather_results: str
    local_info_results: str
    itinerary: str
    price_prediction: Optional[dict]
    sentiment_summary: Optional[dict]
    recommended_attractions: Optional[list]
    llm_calls: Annotated[int, operator.add]


# =========================
# Flight Agent
# =========================

def flight_agent(state: TravelState):
    query = state["user_query"]
    flight_data = search_flights(query)

    return {
        "flight_results": flight_data,
        "messages": [
            AIMessage(content="Flight results fetched.")
        ],
        "llm_calls": 1,
    }


# =========================
# Hotel Agent
# =========================

def hotel_agent(state: TravelState):
    query = f"Best hotels for {state['user_query']}"
    hotel_results = tavily_search(query)

    return {
        "hotel_results": hotel_results,
        "messages": [
            AIMessage(content="Hotel information fetched.")
        ],
        "llm_calls": 1,
    }


# =========================
# Weather Agent  (NEW)
# =========================

def weather_agent(state: TravelState):
    locations = resolve_trip_locations(state["user_query"])
    weather_data = get_weather_forecast(
        locations["destination_city"], locations["destination_country"]
    )

    return {
        "weather_results": weather_data,
        "messages": [
            AIMessage(content="Weather forecast fetched.")
        ],
        "llm_calls": 1,
    }


# =========================
# Local Info Agent  (NEW)
# =========================

def local_info_agent(state: TravelState):
    locations = resolve_trip_locations(state["user_query"])
    local_info_data = get_local_attractions(locations["destination_city"])

    structured = get_attractions_structured(locations["destination_city"]) \
        if locations["destination_city"] else []
    ranked = rank_attractions(structured) if structured else []

    return {
        "local_info_results": local_info_data,
        "recommended_attractions": ranked,
        "messages": [
            AIMessage(content="Local attractions fetched.")
        ],
        "llm_calls": 1,
    }


# =========================
# Itinerary Agent
# =========================
# UPDATED: now also incorporates weather_results and local_info_results
# (previously only had flight + hotel to work with).

def itinerary_agent(state: TravelState):
    prompt = f"""
Create an authentic, detailed Indian domestic travel itinerary.

User Query:
{state['user_query']}

Flight Results:
{state['flight_results']}

Hotel Results:
{state['hotel_results']}

Weather Forecast:
{state['weather_results']}

Local Attractions:
{state['local_info_results']}

STRUCTURE REQUIREMENT:
1. Break down EVERY day requested by the user into 4 specific time slots:
   - 🌅 Morning (08:00 AM – 12:00 PM): Sightseeing, morning walks, heritage exploration, temple/monument visits
   - ☀️ Afternoon (12:00 PM – 04:00 PM): Authentic lunch spots, indoor museums, lakeside/garden strolls, or scenic viewpoints
   - 🌆 Evening (04:00 PM – 08:00 PM): Local bazaars, cultural aarti/performances, sunsets, boat rides, tea/snack stalls
   - 🌙 Night (08:00 PM onwards): Dinner recommendations (specialty veg/non-veg regional delicacies), night walks, or quiet relaxation
2. For EVERY recommended tourist attraction or location, include a direct Google Maps markdown link formatted cleanly as [📍 View](url):
   Format: [📍 View](https://www.google.com/maps/search/?api=1&query=Place+Name+City)
   (Do NOT repeatedly write "View on Google Maps"; write [📍 View](url))
3. Quote all costs, tickets, and budgets in Indian Rupees (₹).
4. Reference weather outlook with weather icons (☀️, ⛅, 🌧️, ❄️) to tailor clothing and timings.
5. COMPLETENESS: Plan for the full duration requested (e.g. Day 1 to Day 10). NEVER leave any day or slot incomplete.
"""

    response = safe_llm_invoke([
        SystemMessage(content="You are an expert Indian domestic travel planner specializing in delightful, time-structured itineraries across India."),
        HumanMessage(content=prompt)
    ])

    return {
        "itinerary": response.content,
        "messages": [response],
        "llm_calls": 1,
    }


# =========================
# Analytics Node  (NEW)
# =========================
# Runs price prediction + sentiment analysis. Both are trainable —
# see analytics/*.py and data/README.md — and fall back to a labeled
# stub if you haven't trained them yet, so this never breaks the run.

def analytics_node(state: TravelState):
    locations = resolve_trip_locations(state["user_query"])

    price_result = price_predictor.predict(
        origin_iata=locations["origin_iata"],
        destination_iata=locations["destination_iata"],
    )
    sentiment_result = sentiment_analyzer.score_hotel_results(state["hotel_results"])

    return {
        "price_prediction": price_result,
        "sentiment_summary": sentiment_result,
        "llm_calls": 0,
    }


# =========================
# Final Response Agent
# =========================
# UPDATED: prompt now surfaces price prediction + sentiment + time-slotted itinerary.

def final_agent(state: TravelState):
    price_pred = state.get("price_prediction") or {}
    sentiment = state.get("sentiment_summary") or {}

    final_prompt = f"""
Generate the final travel response for the user for this Indian domestic trip.

User Request:
{state['user_query']}

Flights:
{state['flight_results']}

Hotels:
{state['hotel_results']}

Weather:
{state['weather_results']}

Local Attractions:
{state['local_info_results']}

Itinerary:
{state['itinerary']}

Price Prediction:
{price_pred}

Hotel Review Sentiment (from search snippets, model_version={sentiment.get('model_version', 'n/a')}):
{sentiment}

Format the final answer beautifully using these exact 8 sections with exact emojis and titles:

1. 🌟 Trip Summary & Overview
2. ✈️ Flight Timetables & IRCTC Air Booking
   - Render a clean markdown table: | Airline & Flight No | Departure Date & Time | Arrival Date & Time | Duration | Approx Price (₹) | Booking Link |
   - CRITICAL DIVERSIFIED AIRFARE REQUIREMENT: In the "Approx Price (₹)" column, every flight MUST show its own realistic, differentiated approximate price in Indian Rupees (₹) based on carrier type, cabin, and departure timings (e.g. IndiGo mid-day at ₹4,200, SpiceJet budget at ₹3,950, Air India morning full-service flight with baggage at ₹6,400, Vistara at ₹6,950). Under NO circumstances should all flights have the exact same price! Label this column strictly "Approx Price (₹)", NOT "Fare".
   - CRITICAL FLIGHT DATES REQUIREMENT: Include realistic Departure Date & Time (e.g. 2026-11-05 06:15 AM) and Arrival Date & Time (e.g. 2026-11-05 08:45 AM).
   - Note: Flight rates are live timetable estimations. To book tickets, click [Book on IRCTC Air](https://www.air.irctc.co.in/) or use the "Book on IRCTC Air" button. Once booked, use "I've Booked My Flight" to update your remaining budget!
3. 🏨 Curated Hotels & Sentiment Analysis
   - Render a clean markdown table: | City | Hotel & Location | Nightly Rate (₹) | Key Amenities | Guest Sentiment |
   - CRITICAL REQUIREMENT FOR HOTEL NAMES: In the "Hotel & Location" column, you MUST include the ACTUAL, REAL NAME of the hotel, and hyperlink that hotel name with Google Maps!
     Example: [**The Grand Dragon Ladakh** 📍](https://www.google.com/maps/search/?api=1&query=The+Grand+Dragon+Ladakh+Leh) – Near Old Road
     DO NOT write `[📍 View]` or generic text instead of the hotel name! The traveler must clearly see the real name of each hotel!
4. ☀️ Weather Outlook & Packing Guide
   - CRITICAL REQUIREMENT: Provide a comprehensive day-by-day weather table covering EVERY SINGLE DAY of the trip duration (Day 1, Day 2, ..., up to Day N matching user's requested days, e.g. all 10 days for a 10-day trip). Do NOT show only 3 or 4 days!
     Columns: | Day & Date | Destination City | Expected High/Low (°C) | Weather Icon & Condition | Recommended Attire & Packing |
   - Follow the table with a checklist of Packing Essentials formatted with markdown checkboxes `- [ ]`:
     - [ ] 🧥 Heavy woolens / thermal base layers & windproof jacket
     - [ ] 🥾 Waterproof trekking shoes / sturdy walking sneakers
     - [ ] 💊 Personal medical kit (AMS tablets, pain relievers, band-aids)
     - [ ] 🧴 High-SPF sunscreen, lip balm & UV sunglasses
     - [ ] 🔌 High-capacity power bank & universal charger
     - [ ] 🪪 Government ID proofs (Aadhaar / Voter ID / Passport) & travel permits
5. 📍 Must-Visit Attractions & Sightseeing
   - Strictly list only the key sightseeing attractions, landmarks, and viewpoints with clean bullet points.
   - DO NOT write any daily schedules, day-wise itineraries, or time slots in this Section 5!
   - For every attraction, start with the Attraction Name in bold, followed by a brief description and a clean [📍 View](url) link at the end:
     Format: - **Attraction Name** – Brief description. [📍 View](https://www.google.com/maps/search/?api=1&query=Attraction+Name+City)
6. 📅 Day-by-Day Time-Slotted Schedule
   - Provide the complete time-slotted itinerary for EVERY SINGLE DAY of the trip (Day 1 up to Day N, e.g. Day 1 to Day 10).
   - Format each day clearly starting with '### Day 1: Title', '### Day 2: Title', etc.
   - For each day, include all 4 time slots:
     - 🌅 Morning (08:00 AM – 12:00 PM)
     - ☀️ Afternoon (12:00 PM – 04:00 PM)
     - 🌆 Evening (04:00 PM – 08:00 PM)
     - 🌙 Night (08:00 PM onwards)
   - Ensure every attraction has a clean [📍 View](url) link!
7. 💰 Estimated Budget Breakdown (₹)
   - Provide a clean, detailed itemized breakdown:
     - ✈️ Round-Trip Flights: ₹...
     - 🏨 Accommodations & Stays: ₹...
     - 🍽️ Regional Dining & Food: ₹...
     - 🚗 Local Cabs / Transport: ₹...
     - 🎟️ Entry Passes & Sightseeing: ₹...
     - 💰 Total Estimated Trip Budget: ₹...
8. 💡 Regional Cuisine Highlights & Local Tips

CRITICAL COMPLETENESS DIRECTIVE:
- You MUST write the ENTIRE plan completely through all 8 sections and all days (e.g. Day 1 through Day 10).
- NEVER truncate, omit, or leave any day or table incomplete.
- All currency MUST be in Indian Rupees (₹).
- Keep the response warm, practical, and 100% focused on Indian domestic travel.
"""

    response = safe_llm_invoke([
        SystemMessage(content="You are a professional AI travel booking assistant for Indian domestic travel. Always generate the 100% full, complete plan without truncating."),
        HumanMessage(content=final_prompt)
    ])

    return {
        "messages": [response],
        "llm_calls": 1,
    }


# =========================
# Build Graph
# =========================
# UPDATED shape (was purely sequential):
#
#              START
#                |
#     -------------------------------
#     |        |         |          |
# flight_agent hotel_agent weather_agent local_info_agent   (parallel)
#     -------------------------------
#                |
#          itinerary_agent   (fan-in)
#                |
#          analytics_node
#                |
#            final_agent
#                |
#               END

graph = StateGraph(TravelState)

graph.add_node("flight_agent", flight_agent)
graph.add_node("hotel_agent", hotel_agent)
graph.add_node("weather_agent", weather_agent)
graph.add_node("local_info_agent", local_info_agent)
graph.add_node("itinerary_agent", itinerary_agent)
graph.add_node("analytics_node", analytics_node)
graph.add_node("final_agent", final_agent)

for agent_name in ["flight_agent", "hotel_agent", "weather_agent", "local_info_agent"]:
    graph.add_edge(START, agent_name)
    graph.add_edge(agent_name, "itinerary_agent")

graph.add_edge("itinerary_agent", "analytics_node")
graph.add_edge("analytics_node", "final_agent")
graph.add_edge("final_agent", END)


# =========================
# PostgreSQL Checkpointer
# =========================
DATABASE_URL = get_database_url()

checkpointer = None
try:
    if "user:password@host" not in DATABASE_URL and ("postgresql" in DATABASE_URL):
        clean_url = DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
        _conn = psycopg.connect(
            clean_url,
            autocommit=True,
            row_factory=dict_row,
            connect_timeout=6
        )
        checkpointer = PostgresSaver(_conn)
        checkpointer.setup()
except Exception as e:
    print("[Checkpointer Warning] PostgresSaver initialization failed, using MemorySaver fallback:", e)
    checkpointer = None

if checkpointer is None:
    from langgraph.checkpoint.memory import MemorySaver
    checkpointer = MemorySaver()

travel_graph = graph.compile(checkpointer=checkpointer)


# =========================
# Structured persistence  (NEW)
# =========================
# Separate from the checkpointer above (which only stores LangGraph's
# internal state snapshots). This writes one queryable row per run to
# travel_plan_records — see db/models.py.

def _persist_plan_record(thread_id: str, user_query: str, result: dict, user_email: str | None = None, dest_name: str | None = None):
    try:
        from db.database import SessionLocal
        from db.models import TravelPlanRecord

        db = SessionLocal()
        try:
            existing = None
            if user_email and dest_name:
                existing = db.query(TravelPlanRecord).filter(
                    TravelPlanRecord.user_email == user_email,
                    TravelPlanRecord.dest_name == dest_name
                ).first()

            if existing:
                existing.thread_id = thread_id
                existing.user_query = user_query
                existing.flight_results = result.get("flight_results", "")
                existing.hotel_results = result.get("hotel_results", "")
                existing.weather_results = result.get("weather_results", "")
                existing.local_info_results = result.get("local_info_results", "")
                existing.itinerary = result.get("itinerary", "")
                existing.final_answer = result.get("answer", "")
                existing.price_prediction = result.get("price_prediction")
                existing.sentiment_summary = result.get("sentiment_summary")
                existing.llm_calls = result.get("llm_calls", 0)
                db.commit()
            else:
                record = TravelPlanRecord(
                    thread_id=thread_id,
                    user_query=user_query,
                    user_email=user_email,
                    dest_name=dest_name,
                    flight_results=result.get("flight_results", ""),
                    hotel_results=result.get("hotel_results", ""),
                    weather_results=result.get("weather_results", ""),
                    local_info_results=result.get("local_info_results", ""),
                    itinerary=result.get("itinerary", ""),
                    final_answer=result.get("answer", ""),
                    price_prediction=result.get("price_prediction"),
                    sentiment_summary=result.get("sentiment_summary"),
                    llm_calls=result.get("llm_calls", 0),
                )
                db.add(record)
                db.commit()
        finally:
            db.close()
    except Exception as e:
        # Non-fatal: structured persistence is an enhancement.
        print(f"[persist_plan_record] Failed to persist structured record: {e}")


# =========================
# Function for FastAPI
# =========================

def run_travel_agent(user_input: str, thread_id: str | None = None, user_email: str | None = None, dest_name: str | None = None):
    if not thread_id:
        thread_id = f"user_{uuid.uuid4().hex}"

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    result = travel_graph.invoke(
        {
            "messages": [
                HumanMessage(content=user_input)
            ],
            "user_query": user_input,
            "flight_results": "",
            "hotel_results": "",
            "weather_results": "",
            "local_info_results": "",
            "itinerary": "",
            "price_prediction": None,
            "sentiment_summary": None,
            "recommended_attractions": None,
            "llm_calls": 0
        },
        config=config
    )

    final_answer = result["messages"][-1].content

    output = {
        "thread_id": thread_id,
        "answer": final_answer,
        "flight_results": result.get("flight_results", ""),
        "hotel_results": result.get("hotel_results", ""),
        "weather_results": result.get("weather_results", ""),
        "local_info_results": result.get("local_info_results", ""),
        "itinerary": result.get("itinerary", ""),
        "price_prediction": result.get("price_prediction"),
        "sentiment_summary": result.get("sentiment_summary"),
        "recommended_attractions": result.get("recommended_attractions"),
        "llm_calls": result.get("llm_calls", 0),
    }

    _persist_plan_record(thread_id, user_input, output, user_email=user_email, dest_name=dest_name)

    return output
