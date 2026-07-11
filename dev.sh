#!/bin/bash

# Start the pgvector database container
echo "Starting PostgreSQL database container..."
docker-compose up -d db

# Wait for database to be ready
until docker exec moodflix_db pg_isready -U moodflix -d moodflix >/dev/null 2>&1; do
    echo "Waiting for database to be ready..."
    sleep 1
done

echo "Database is ready! Starting backend and frontend..."

# Concurrent startup of Go server and Next.js frontend
trap 'kill 0' EXIT
(cd backend && go run cmd/server/main.go) &
(cd frontend && npm run dev) &
wait
