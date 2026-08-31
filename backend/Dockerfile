# syntax=docker/dockerfile:1

# 3.11 matches the interpreter the lockfile was generated against. slim rather
# than alpine: psycopg ships manylinux wheels, and alpine's musl libc would
# force a source build of it and its C dependencies.
FROM python:3.11-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1


# --- dependencies -----------------------------------------------------------
# Split from the source copy so this layer is reused whenever only code changed.
FROM base AS deps
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt


# --- runtime ----------------------------------------------------------------
FROM base AS runner

COPY --from=deps /install /usr/local
COPY . .

# Run as a non-root user: a compromised process should not own the filesystem.
RUN useradd --create-home --uid 1001 appuser
USER appuser

EXPOSE 8000

# No --reload: it watches the filesystem and would restart the container's only
# process on any write.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
