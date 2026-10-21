"""
Structured tables — the missing piece vs. the original repo, which
only persisted LangGraph conversation-state checkpoints, not queryable
plan records.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID

from db.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class UserRecord(Base):
    """User account storing profile credentials and authentication."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TravelPlanRecord(Base):
    """One row per /api/travel call — the full multi-agent output."""
    __tablename__ = "travel_plan_records"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    thread_id = Column(String, index=True, nullable=False)
    user_query = Column(Text, nullable=False)
    user_email = Column(String, index=True, nullable=True)
    dest_name = Column(String, nullable=True)

    flight_results = Column(Text, nullable=True)
    hotel_results = Column(Text, nullable=True)
    weather_results = Column(Text, nullable=True)
    local_info_results = Column(Text, nullable=True)
    itinerary = Column(Text, nullable=True)
    final_answer = Column(Text, nullable=True)

    price_prediction = Column(JSON, nullable=True)
    sentiment_summary = Column(JSON, nullable=True)

    llm_calls = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserConversationRecord(Base):
    """Stores full ChatGPT-style chat sessions for users across months and logins."""
    __tablename__ = "user_conversations"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_email = Column(String, index=True, nullable=False)
    title = Column(String, nullable=True)
    messages = Column(JSON, nullable=False, default=list)
    params = Column(JSON, nullable=True)
    travel_plan = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

