#!/bin/sh

echo "Starting Next.js + Nginx services..."

# Ensure ALL permissions are set including /var/run
chmod -R 777 /var/log/nginx /var/cache/nginx /var/lib/nginx /run/nginx /var/run /app
touch /var/log/nginx/error.log /var/log/nginx/access.log /app/logs/nginx.pid
chmod 777 /var/log/nginx/error.log /var/log/nginx/access.log /app/logs/nginx.pid

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t
if [ $? -ne 0 ]; then
    echo "Nginx configuration test failed!"
    exit 1
fi

# Start Next.js in background
echo "Starting Next.js server..."
cd /app && node server.js &
NEXTJS_PID=$!

# Wait a moment for Next.js to start
sleep 3

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
echo "Services started successfully!"
echo "Next.js PID: $NEXTJS_PID, Nginx PID: $NGINX_PID"
echo "PID file location: /app/logs/nginx.pid"
echo "Log files: /var/log/nginx/"

# Keep container running
wait