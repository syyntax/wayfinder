#!/bin/sh

echo ""
echo "=============================================="
echo "  WAYFINDER - Dark Fantasy Cyberpunk Kanban  "
echo "=============================================="
echo ""

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    echo "[SECURITY] No JWT_SECRET provided, generating secure random secret..."
    export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    echo "[SECURITY] JWT secret generated successfully"
fi

# Create upload directories if they don't exist
# Export UPLOAD_DIR so Node.js process can access it
export UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"
echo "[UPLOADS] Ensuring upload directories exist..."
mkdir -p "$UPLOAD_DIR/covers"
mkdir -p "$UPLOAD_DIR/attachments"
mkdir -p "$UPLOAD_DIR/avatars"
echo "[UPLOADS] Upload directories ready at $UPLOAD_DIR"

# Initialize database if it doesn't exist
if [ ! -f "$DATABASE_PATH" ]; then
    echo "[DATABASE] Initializing new database at $DATABASE_PATH..."
    node src/db/init.js
    echo "[DATABASE] Database initialized successfully"
else
    echo "[DATABASE] Using existing database at $DATABASE_PATH"
fi

echo ""
echo "[SERVER] Starting Wayfinder on port $PORT..."
echo ""

# Start the application
exec node src/server.js
