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

# Backup database (skip if container doesn't exist - first deployment)
echo "📦 Creating database backup..."
if docker exec monitor-postgres pg_dump -U monitor_user monitor_db > "$BACKUP_DIR/backup_$TIMESTAMP.sql" 2>/dev/null; then
    echo "✓ Database backed up to $BACKUP_DIR/backup_$TIMESTAMP.sql"
else
    echo "ℹ️  Skipping backup (first deployment or database not running)"
fi

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
MAX_WAIT=120  # Maximum wait time in seconds
WAIT_TIME=0
INTERVAL=5

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    # Check if all containers are healthy
    POSTGRES_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' monitor-postgres 2>/dev/null || echo "starting")
    REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' monitor-redis 2>/dev/null || echo "starting")
    BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' monitor-backend 2>/dev/null || echo "starting")

    echo "  Postgres: $POSTGRES_HEALTH | Redis: $REDIS_HEALTH | Backend: $BACKEND_HEALTH"

    if [ "$POSTGRES_HEALTH" = "healthy" ] && [ "$REDIS_HEALTH" = "healthy" ] && [ "$BACKEND_HEALTH" = "healthy" ]; then
        echo "✓ All services are healthy!"
        break
    fi

    sleep $INTERVAL
    WAIT_TIME=$((WAIT_TIME + INTERVAL))
done

if [ $WAIT_TIME -ge $MAX_WAIT ]; then
    echo "⚠️  Timeout waiting for services to be healthy"
    echo ""
    echo "📋 Backend container logs:"
    docker logs monitor-backend --tail 50
    echo ""
    echo "📋 PostgreSQL container logs:"
    docker logs monitor-postgres --tail 30
    echo ""

    # Rollback
    echo "🔄 Rolling back due to timeout..."
    docker-compose -f docker-compose.prod.yml down

    # Restore from backup if needed
    # docker exec -i monitor-postgres psql -U monitor_user monitor_db < "$BACKUP_DIR/backup_$TIMESTAMP.sql"

    exit 1
fi

echo "✅ All services are healthy and running!"

# Show running containers
echo "📊 Running containers:"
docker-compose -f docker-compose.prod.yml ps

# Clean old backups (keep last 7)
echo "🧹 Cleaning old backups..."
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs -r rm

echo "✅ Deployment completed successfully!"
echo "🌐 Backend available at: https://monitoreo.victalejo.dev"
