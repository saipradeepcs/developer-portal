# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5001 \
    DEBUG=false

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Set environment variable for data directory
ENV DATA_DIR=/app/data

# Copy application code, models, database init script, templates, and static files
COPY app.py .
COPY models.py .
COPY init_db.py .
COPY entrypoint.sh .
COPY templates/ templates/
COPY static/ static/

# Make entrypoint script executable
RUN chmod +x entrypoint.sh

# Don't initialize database during build - do it at runtime instead
# This ensures the database is created in the persistent volume

# Use entrypoint script to handle database initialization at runtime
ENTRYPOINT ["./entrypoint.sh"]

# Create non-root user
RUN adduser --disabled-password --gecos '' --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Run the application
CMD ["python", "app.py"]