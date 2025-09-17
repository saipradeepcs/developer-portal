"""
Database models for the Zello Developer Portal
Optimized for SQLite with proper indexing and performance considerations
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
import json

db = SQLAlchemy()

class Service(db.Model):
    """Service model for storing registered services"""
    
    __tablename__ = 'services'
    
    # Primary key and unique identifiers
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False, unique=True)
    
    # Core service metadata with indexes for filtering
    owner = db.Column(db.String(100), nullable=False, index=True)
    language = db.Column(db.String(50), nullable=False, index=True)
    repo = db.Column(db.String(500), nullable=False)
    
    # Timestamps with indexes for sorting
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Deployment tracking
    deployed_version = db.Column(db.String(50), nullable=True)
    deployed_at = db.Column(db.DateTime, nullable=True, index=True)  # Index for deployment queries
    
    # Extended metadata
    description = db.Column(db.Text, nullable=True)
    tags = db.Column(db.Text, nullable=True)  # JSON string of tags
    
    # Health status cache (updated periodically)
    last_health_check = db.Column(db.DateTime, nullable=True)
    health_status = db.Column(db.String(20), nullable=True, default='unknown')
    
    # Performance optimization: composite indexes
    __table_args__ = (
        db.Index('idx_owner_language', 'owner', 'language'),
        db.Index('idx_language_created', 'language', 'created_at'),
        db.Index('idx_owner_created', 'owner', 'created_at'),
        db.Index('idx_deployment_status', 'deployed_version', 'deployed_at'),
    )
    
    def __repr__(self):
        return f'<Service {self.name}>'
    
    def to_dict(self, include_status: bool = True) -> Dict[str, Any]:
        """Convert service to dictionary for API responses"""
        result = {
            'id': self.id,
            'name': self.name,
            'owner': self.owner,
            'language': self.language,
            'repo': self.repo,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'deployed_version': self.deployed_version,
            'deployed_at': self.deployed_at.isoformat() if self.deployed_at else None,
            'description': self.description,
            'tags': self.parse_tags() if self.tags else []
        }
        
        # Add health status
        if include_status:
            # Use cached status if recent (within 5 minutes), otherwise simulate
            if (self.last_health_check and 
                (datetime.now(datetime.timezone.utc) - self.last_health_check).seconds < 300):
                result['status'] = self.health_status
            else:
                # Simulate health check (30% chance of being unhealthy)
                import random
                result['status'] = 'healthy' if random.random() > 0.3 else 'unhealthy'
        
        return result
    
    def parse_tags(self) -> List[str]:
        """Parse tags from JSON string"""
        if not self.tags:
            return []
        try:
            return json.loads(self.tags)
        except json.JSONDecodeError:
            return []
    
    def set_tags(self, tags: List[str]) -> None:
        """Set tags as JSON string"""
        self.tags = json.dumps(tags) if tags else None
    
    @classmethod
    def create_service(cls, data: Dict[str, Any]) -> 'Service':
        """Create a new service from dictionary data"""
        service = cls(
            name=data['name'],
            owner=data['owner'],
            language=data['language'],
            repo=data['repo'],
            description=data.get('description'),
            health_status='unknown'
        )
        
        # Handle tags
        if data.get('tags'):
            service.set_tags(data['tags'])
        
        return service
    
    def update_deployment(self, version: str) -> None:
        """Update service deployment information"""
        self.deployed_version = version
        self.deployed_at = datetime.now(datetime.timezone.utc)
        self.updated_at = datetime.now(datetime.timezone.utc)
        # Assume successful deployment means healthy service
        self.health_status = 'healthy'
        self.last_health_check = datetime.now(datetime.timezone.utc)
    
    def update_health_status(self, status: str) -> None:
        """Update cached health status"""
        self.health_status = status
        self.last_health_check = datetime.now(datetime.timezone.utc)
    
    @classmethod
    def get_owners(cls) -> List[str]:
        """Get all unique owners for filtering"""
        result = db.session.query(cls.owner).distinct().order_by(cls.owner).all()
        return [row[0] for row in result]
    
    @classmethod
    def get_languages(cls) -> List[str]:
        """Get all unique languages for filtering"""
        result = db.session.query(cls.language).distinct().order_by(cls.language).all()
        return [row[0] for row in result]
    
    @classmethod
    def get_deployment_stats(cls) -> Dict[str, int]:
        """Get deployment statistics"""
        deployed_count = db.session.query(cls).filter(cls.deployed_version.isnot(None)).count()
        total_count = db.session.query(cls).count()
        return {
            'total_services': total_count,
            'deployed_services': deployed_count,
            'undeployed_services': total_count - deployed_count
        }


class ServiceEvent(db.Model):
    """Model for tracking service events and history"""
    
    __tablename__ = 'service_events'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    service_id = db.Column(db.String(36), db.ForeignKey('services.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)  # 'created', 'deployed', 'updated', 'health_check'
    event_data = db.Column(db.Text, nullable=True)  # JSON string of event details
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by = db.Column(db.String(100), nullable=True)  # User who triggered the event
    
    # Relationships
    service = db.relationship('Service', backref=db.backref('events', lazy=True, order_by='ServiceEvent.created_at.desc()'))
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_service_events', 'service_id', 'created_at'),
        db.Index('idx_event_type_date', 'event_type', 'created_at'),
    )
    
    def __repr__(self):
        return f'<ServiceEvent {self.event_type} for {self.service_id}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary for API responses"""
        return {
            'id': self.id,
            'service_id': self.service_id,
            'event_type': self.event_type,
            'event_data': json.loads(self.event_data) if self.event_data else None,
            'created_at': self.created_at.isoformat(),
            'created_by': self.created_by
        }
    
    @classmethod
    def log_event(cls, service_id: str, event_type: str, event_data: Optional[Dict] = None, created_by: Optional[str] = None) -> 'ServiceEvent':
        """Log a new service event"""        
        event = cls(
            service_id=service_id,
            event_type=event_type,
            event_data=json.dumps(event_data) if event_data else None,
            created_by=created_by
        )
        return event
    
    @classmethod
    def get_recent_deployments(cls, limit: int = 10) -> List['ServiceEvent']:
        """Get recent deployment events"""
        return cls.query.filter_by(event_type='deployed').order_by(cls.created_at.desc()).limit(limit).all()
    
    @classmethod
    def get_activity_summary(cls, days: int = 30) -> Dict[str, int]:
        """Get activity summary for the last N days"""
        from sqlalchemy import func
        
        cutoff_date = datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
        
        result = db.session.query(
            cls.event_type,
            func.count(cls.id).label('count')
        ).filter(
            cls.created_at >= cutoff_date
        ).group_by(cls.event_type).all()
        
        return {row[0]: row[1] for row in result}


def init_sample_data():
    """Initialize database with sample data for demonstration"""
    
    # Check if we already have data
    if Service.query.first():
        return
    
    sample_services = [
        {
            'name': 'auth-service',
            'owner': 'identity-team',
            'language': 'python',
            'repo': 'https://github.com/example/auth-service',
            'description': 'Authentication and authorization service',
            'tags': ['auth', 'security', 'core']
        },
        {
            'name': 'user-service',
            'owner': 'platform-team',
            'language': 'go',
            'repo': 'https://github.com/example/user-service',
            'description': 'User management and profile service',
            'tags': ['users', 'profiles', 'core']
        },
        {
            'name': 'notification-service',
            'owner': 'communications-team',
            'language': 'typescript',
            'repo': 'https://github.com/example/notification-service',
            'description': 'Push notifications and messaging service',
            'tags': ['notifications', 'messaging', 'integration']
        },
        {
            'name': 'analytics-service',
            'owner': 'data-team',
            'language': 'python',
            'repo': 'https://github.com/example/analytics-service',
            'description': 'Data analytics and reporting service',
            'tags': ['analytics', 'data', 'reporting']
        },
        {
            'name': 'payment-service',
            'owner': 'commerce-team',
            'language': 'java',
            'repo': 'https://github.com/example/payment-service',
            'description': 'Payment processing and billing service',
            'tags': ['payments', 'billing', 'commerce']
        }
    ]
    
    created_services = []
    
    # First, create all services and commit them to get proper IDs
    for service_data in sample_services:
        service = Service.create_service(service_data)
        db.session.add(service)
        created_services.append(service)
    
    # Commit services first to ensure they have IDs
    try:
        db.session.commit()
        print("✅ Sample services created")
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating sample services: {e}")
        return
    
    # Now create events for the services that have proper IDs
    try:
        for service in created_services:
            # Add creation event
            event = ServiceEvent.log_event(
                service_id=service.id,
                event_type='created',
                event_data={
                    'name': service.name,
                    'owner': service.owner,
                    'language': service.language
                }
            )
            db.session.add(event)
            
            # Deploy some services
            if service.name in ['auth-service', 'notification-service']:
                service.update_deployment('v1.2.3' if service.name == 'auth-service' else 'v2.1.0')
                
                deploy_event = ServiceEvent.log_event(
                    service_id=service.id,
                    event_type='deployed',
                    event_data={
                        'version': service.deployed_version,
                        'deployed_at': service.deployed_at.isoformat()
                    }
                )
                db.session.add(deploy_event)
        
        db.session.commit()
        print("✅ Sample events created")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating sample events: {e}")
        return


def optimize_database():
    """Apply SQLite-specific optimizations"""
    try:
        # Enable WAL mode for better concurrent access
        with db.engine.connect() as conn:
            conn.execute(db.text('PRAGMA journal_mode=WAL'))
            conn.execute(db.text('PRAGMA synchronous=NORMAL'))
            conn.execute(db.text('PRAGMA cache_size=10000'))
            conn.execute(db.text('PRAGMA temp_store=memory'))
            conn.execute(db.text('ANALYZE'))
            conn.commit()
        
        print("✅ Database optimizations applied")
    except Exception as e:
        print(f"⚠️ Warning: Could not apply some database optimizations: {e}")