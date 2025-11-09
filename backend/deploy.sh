#!/bin/bash

# Deployment script for Monitor Backend
# This script is executed by GitHub Actions on the server

set -e

echo "🚀 Starting deployment..."

# Variables
PROJECT_DIR="/opt/monitor-app/backend"
BACKUP_DIR="/opt/monitor-app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
echo "📦 Creating database backup..."
docker exec monitor-postgres pg_dump -U monitor_user monitor_db > "$BACKUP_DIR/backup_$TIMESTAMP.sql"
echo "✓ Database backed up to $BACKUP_DIR/backup_$TIMESTAMP.sql"

# Pull latest code (already done by GitHub Actions)
cd $PROJECT_DIR
echo "📁 Current directory: $(pwd)"

# Stop containers
echo "🛑 Stopping containers..."
docker-compose -f docker-compose.prod.yml down

# Remove old images
echo "🗑️  Removing old images..."
docker image prune -f

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking health..."
HEALTH_CHECK=$(curl -s http://localhost:3000/health || echo "failed")

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
    echo "✅ Backend is healthy!"
else
    echo "❌ Backend health check failed!"
    echo "Response: $HEALTH_CHECK"

    # Rollback
    echo "🔄 Rolling back to previous version..."
    docker-compose -f docker-compose.prod.yml down

    # Restore from backup if needed
    # docker exec -i monitor-postgres psql -U monitor_user monitor_db < "$BACKUP_DIR/backup_$TIMESTAMP.sql"

    exit 1
fi

# Show running containers
echo "📊 Running containers:"
docker-compose -f docker-compose.prod.yml ps

# Clean old backups (keep last 7)
echo "🧹 Cleaning old backups..."
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs -r rm

echo "✅ Deployment completed successfully!"
echo "🌐 Backend available at: https://monitoreo.victalejo.dev"
