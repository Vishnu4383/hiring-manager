FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
ENV PATH="/app/.venv/bin:$PATH"
COPY . .
COPY --from=web /web/dist frontend/dist
CMD ["sh", "-c", "python manage.py migrate && gunicorn jobs_tracker.wsgi --bind 0.0.0.0:${PORT:-10000} --workers 2"]
