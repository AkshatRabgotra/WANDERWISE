"""
Structured persistence layer — separate from backend.py's
PostgresSaver checkpointer (which only stores LangGraph's internal
conversation-state snapshots, not queryable travel-plan records).

Reuses the same DATABASE_URL as the checkpointer, but through
SQLAlchemy so we get real tables: travel_plan_records,
flight_price_predictions.

NOTE: this file intentionally does NOT import backend.py, to avoid
triggering backend.py's top-level side effects (LLM client creation,
opening the checkpointer's own DB connection) just by importing this
module. get_database_url() below is a deliberate small duplication of
the same logic in backend.py — keep both in sync if you change one.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    
    # If no URL or placeholder URL, seamlessly fall back to local SQLite
    if not database_url or "user:password@host" in database_url:
        return "sqlite:///./wanderwise.db"

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

    if "sslmode=" not in database_url and not database_url.startswith("sqlite"):
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"

    # SQLAlchemy needs an explicit driver in the scheme for PostgreSQL
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        
    return database_url


def create_resilient_engine():
    db_url = get_database_url()
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})

    try:
        eng = create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=4,
            connect_args={"connect_timeout": 3}
        )
        with eng.connect() as conn:
            pass
        return eng
    except Exception as e:
        print(f"[Database Notice] Remote PostgreSQL not reachable ({e}). Falling back to local SQLite database (wanderwise.db).")
        return create_engine("sqlite:///./wanderwise.db", connect_args={"check_same_thread": False})


engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    try:
        from db import models
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print("[Database init_db error]:", e)


init_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
