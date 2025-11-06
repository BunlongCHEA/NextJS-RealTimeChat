#!/bin/sh

echo "Starting Next.js + Nginx services..."

# Start Next.js in background
echo "Starting Next.js server..."
cd /app && node server.js &
NEXTJS_PID=$!

# Start Nginx in background
echo "Starting Nginx..."
nginx &
NGINX_PID=$!

# Function to cleanup on exit
cleanup() {
    echo "Stopping services..."
    kill $NEXTJS_PID $NGINX_PID 2>/dev/null
    exit
}

# Trap signals
trap cleanup TERM INT

# Wait for processes
echo "Services started. Next.js PID: $NEXTJS_PID, Nginx PID: $NGINX_PID"
wait