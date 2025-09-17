#!/bin/bash

# Entrypoint script for Zello Developer Portal
# This ensures database is initialized in the persistent volume at runtime

set -e

echo "🚀 Starting Zello Developer Portal..."

# Ensure DATA_DIR is set
export DATA_DIR=${DATA_DIR:-/app/data}
DB_PATH="${DATA_DIR}/developer_portal.db"

echo "📂 Data directory: $DATA_DIR"
echo "📍 Database path: $DB_PATH"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# List contents of data directory for debugging
echo "📋 Contents of data directory:"
ls -la "$DATA_DIR" || echo "Directory is empty or doesn't exist"

# Check if database file exists
if [ ! -f "$DB_PATH" ]; then
    echo "🗄️ Database not found, initializing..."
    
    # Set the DATA_DIR environment variable for the Python script
    export DATA_DIR="$DATA_DIR"
    
    # Initialize database
    if python init_db.py; then
        echo "✅ Database initialization script completed"
        
        # Give a moment for file system sync
        sleep 1
        
        # Verify database was created
        if [ -f "$DB_PATH" ]; then
            echo "✅ Database successfully created at: $DB_PATH"
            ls -la "$DB_PATH"
        else
            echo "⚠️ Database initialization completed but file not immediately visible"
            echo "   This might be normal due to filesystem sync delays"
        fi
    else
        echo "❌ Database initialization script failed"
        exit 1
    fi
else
    echo "✅ Existing database found at: $DB_PATH"
    ls -la "$DB_PATH"
    
    # Check if database has any services
    SERVICE_COUNT=$(python3 -c "
import sqlite3
import os
db_path = os.environ.get('DATA_DIR', '/app/data') + '/developer_portal.db'
try:
    conn = sqlite3.connect(db_path)
    cursor = conn.execute('SELECT COUNT(*) FROM services')
    count = cursor.fetchone()[0]
    conn.close()
    print(count)
except Exception as e:
    print('0')
    " 2>/dev/null || echo "0")
    
    echo "📊 Found $SERVICE_COUNT existing services in database"
fi

# Verify the volume mount is working
echo "🔍 Volume mount verification:"
echo "  DATA_DIR: $DATA_DIR" 
echo "  Database exists: $([ -f "$DB_PATH" ] && echo "YES" || echo "NO")"
echo "  Database size: $([ -f "$DB_PATH" ] && du -h "$DB_PATH" 2>/dev/null || echo "N/A")"

# Start the Flask application
echo "🌐 Starting web server on port ${PORT:-5001}..."
exec python app.py