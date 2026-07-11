cmake_minimum_required(VERSION 3.10)
project(movieflix)

# Custom target that delegates development startup to the Makefile
add_custom_target(dev
    COMMAND make dev
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    USES_TERMINAL
    COMMENT "Starting MoodFlix in development mode..."
)
