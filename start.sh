#!/bin/sh

echo "Starting Next.js + Nginx services..."

# Ensure all permissions are set
chmod -R 777 /var/log/nginx /var/cache/nginx /var/lib/nginx /run/nginx
touch /var/log/nginx/error.log /var/log/nginx/access.log
chmod 777 /var/log/nginx/error.log /var/log/nginx/access.log

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Start Next.js in background
echo "Starting Next.js server..."
cd /app && node server.js &
NEXTJS_PID=$!

# Wait a moment for Next.js to start
sleep 2

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