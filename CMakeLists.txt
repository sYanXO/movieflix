cmake_minimum_required(VERSION 3.10)
project(movieflix)

# Target that runs the dev.sh script
add_custom_target(dev
    COMMAND ${CMAKE_SOURCE_DIR}/dev.sh
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
