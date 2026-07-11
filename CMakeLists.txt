cmake_minimum_required(VERSION 3.10)
project(movieflix)

# Starts database, checks readiness, and runs backend & frontend concurrently
add_custom_target(dev
    COMMAND docker-compose up -d db
    COMMAND bash -c "until docker exec moodflix_db pg_isready -U moodflix -d moodflix >/dev/null 2>&1; do echo 'Waiting for database to be ready...'; sleep 1; done"
    COMMAND echo "Database is ready! Starting backend and frontend..."
    COMMAND bash -c "trap 'kill 0' EXIT; (cd ${CMAKE_SOURCE_DIR}/backend && go run cmd/server/main.go) & (cd ${CMAKE_SOURCE_DIR}/frontend && npm run dev) & wait"
    USES_TERMINAL
    COMMENT "Starting MoodFlix in development mode..."
)

# Starts database container
add_custom_target(db-up
    COMMAND docker-compose up -d db
    USES_TERMINAL
    COMMENT "Starting PostgreSQL database container..."
)

# Stops database container
add_custom_target(db-down
    COMMAND docker-compose down
    USES_TERMINAL
    COMMENT "Stopping database containers..."
)

# Cleans up database containers
add_custom_target(clean-db
    COMMAND docker-compose down
    USES_TERMINAL
    COMMENT "Cleaning up database containers..."
)
