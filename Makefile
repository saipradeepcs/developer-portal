.PHONY: help install run docker-build docker-run docker-stop test clean init-db reset-db

# Default target
help:
	@echo "🛠️  Zello Developer Portal - Available Commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make install     - Install Python dependencies"
	@echo "  make init-db     - Initialize database with sample data"
	@echo "  make reset-db    - Reset database (delete and recreate)"
	@echo "  make run         - Run the application locally"
	@echo "  make test        - Run API tests"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run with Docker Compose"
	@echo "  make docker-stop  - Stop Docker containers"
	@echo "  make docker-logs  - View Docker logs"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean       - Clean up temporary files"
	@echo "  make archive     - Create deployment archive"
	@echo ""

# Local development
install:
	@echo "📦 Installing dependencies..."
	pip install -r requirements.txt

init-db:
	@echo "🗄️ Initializing database..."
	python init_db.py

reset-db:
	@echo "🔄 Resetting database..."
	python init_db.py --reset

run:
	@echo "🚀 Starting Zello Developer Portal..."
	python app.py

# Docker commands
docker-build:
	@echo "🐳 Building Docker image..."
	docker build -t zello-dev-portal .

docker-run:
	@echo "🐳 Starting with Docker Compose (with persistent storage)..."
	docker-compose up --build

docker-stop:
	@echo "🛑 Stopping Docker containers..."
	docker-compose down

docker-logs:
	@echo "📋 Viewing Docker logs..."
	docker-compose logs -f

docker-clean:
	@echo "🧹 Removing containers and images (keeping data)..."
	docker-compose down
	docker rmi zello-dev-portal 2>/dev/null || true

docker-reset:
	@echo "⚠️  Removing containers, images, AND DATA VOLUME..."
	@read -p "This will DELETE ALL DATA. Are you sure? (y/N) " confirm && [ "$confirm" = "y" ]
	docker-compose down -v
	docker rmi zello-dev-portal 2>/dev/null || true

docker-backup:
	@echo "💾 Backing up database..."
	@mkdir -p backups
	docker run --rm -v $(docker-compose ps -q dev-portal | head -1 | xargs docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || echo "zello-dev-portal_developer_portal_data"):/data -v $(pwd)/backups:/backup alpine cp /data/developer_portal.db /backup/developer_portal_$(date +%Y%m%d_%H%M%S).db
	@echo "✅ Backup created in ./backups/"

# Testing
test:
	@echo "🧪 Running tests..."
	@if [ -f "test_api.sh" ]; then \
		bash test_api.sh; \
	else \
		echo "Tests not implemented yet. You can test manually using:"; \
		echo "  curl http://localhost:5000/health"; \
		echo "  curl http://localhost:5000/api/services"; \
	fi

# Cleanup
clean:
	@echo "🧹 Cleaning up..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	docker system prune -f

# Create deployment archive
archive:
	@echo "📦 Creating deployment archive..."
	tar -czf zello-dev-portal.tar.gz \
		app.py \
		models.py \
		init_db.py \
		requirements.txt \
		templates/ \
		static/ \
		Dockerfile \
		docker-compose.yml \
		README.md \
		Makefile
	@echo "✅ Created zello-dev-portal.tar.gz"