#!/usr/bin/env python3
"""
Database initialization script for Zello Developer Portal
Run this script to create the database and initialize sample data
"""

import os
import sys
from app_copy import app, db
from models import Service, ServiceEvent, init_sample_data, optimize_database

def init_database():
    """Initialize the database with tables and sample data"""
    print("🚀 Initializing Zello Developer Portal Database...")
    
    with app.app_context():
        try:
            # Get database path for logging (use the same logic as app.py)
            basedir = os.path.abspath(os.path.dirname(__file__))
            data_dir = os.environ.get('DATA_DIR', basedir)
            db_path = os.path.join(data_dir, "developer_portal.db")
            
            print(f"📍 Database location: {db_path}")
            print(f"📂 Data directory: {data_dir}")
            
            # Ensure data directory exists
            os.makedirs(data_dir, exist_ok=True)
            
            # Drop existing tables if they exist (for clean initialization)
            if '--reset' in sys.argv:
                print("🔄 Resetting database (dropping existing tables)...")
                db.drop_all()
            
            # Create all tables
            print("📋 Creating database tables...")
            db.create_all()
            
            # Apply SQLite optimizations
            print("⚡ Applying SQLite optimizations...")
            optimize_database()
            
            # Check if we already have data
            existing_services = Service.query.count()
            if existing_services > 0:
                print(f"ℹ️ Database already contains {existing_services} services")
                if '--force-sample-data' not in sys.argv:
                    print("✅ Database initialization complete!")
                    return
            
            # Initialize with sample data
            print("📦 Adding sample data...")
            init_sample_data()
            
            # Verify initialization
            service_count = Service.query.count()
            event_count = ServiceEvent.query.count()
            
            print(f"✅ Database initialization complete!")
            print(f"   📊 Services created: {service_count}")
            print(f"   📋 Events logged: {event_count}")
            print(f"   📄 Database file: {db_path}")
            
            # Show sample services
            print("\n🛠️ Sample services created:")
            for service in Service.query.limit(5).all():
                deployed = f" (v{service.deployed_version})" if service.deployed_version else " (not deployed)"
                print(f"   • {service.name} [{service.language}] - {service.owner}{deployed}")
            
        except Exception as e:
            print(f"❌ Database initialization failed: {e}")
            sys.exit(1)

if __name__ == '__main__':
    # Print usage help
    if '--help' in sys.argv or '-h' in sys.argv:
        print("""
Zello Developer Portal - Database Initialization

Usage:
    python init_db.py                    # Initialize database with sample data
    python init_db.py --reset            # Reset database (drop all tables first)
    python init_db.py --force-sample-data # Add sample data even if services exist
    python init_db.py --help             # Show this help message

The database file 'developer_portal.db' will be created in the current directory.
        """)
        sys.exit(0)
    
    init_database()