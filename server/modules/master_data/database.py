import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Resolve database URL from environment or default to PostgreSQL / SQLite fallback
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'peoplepay360')}"
)

def _create_engine():
    db_url = os.getenv(
        "DATABASE_URL",
        f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres')}@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'peoplepay360')}"
    )
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})
    try:
        eng = create_engine(db_url, pool_pre_ping=True)
        with eng.connect() as conn:
            pass
        return eng
    except Exception:
        fallback_sqlite_url = "sqlite:///./peoplepay360.db"
        return create_engine(fallback_sqlite_url, connect_args={"check_same_thread": False})

engine = _create_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
