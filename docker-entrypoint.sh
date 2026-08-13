#!/bin/sh
set -e

# Wait for WordPress container to be available
echo "Waiting for WordPress container to be ready..."
max_attempts=30
attempt=0
until getent hosts wordpress > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -ge $max_attempts ]; then
        echo "ERROR: WordPress container did not become available after $max_attempts attempts"
        echo "Continuing anyway - Nginx will retry DNS resolution"
        break
    fi
    echo "WordPress DNS not resolved yet (attempt $attempt/$max_attempts) - sleeping"
    sleep 2
done

if getent hosts wordpress > /dev/null 2>&1; then
    echo "WordPress container is resolvable, waiting for port 9000..."
    until nc -z wordpress 9000 2>/dev/null; do
        echo "WordPress port 9000 not ready - sleeping"
        sleep 2
    done
    echo "WordPress is ready!"
else
    echo "WARNING: Proceeding without WordPress DNS confirmation"
fi

# Create processed configurations directory
mkdir -p /etc/nginx/conf.d

# Process environment variables in Nginx configuration files
for file in /etc/nginx/conf.d.template/*.conf; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        envsubst '${DOMAIN}' < "$file" > "/etc/nginx/conf.d/$filename"
    fi
done

# Handle cache disabling
if [ "$ENABLE_CACHING" = "false" ]; then
    echo "Disabling FastCGI cache"
    # Comment out fastcgi_cache directives in all site configs
    for config in /etc/nginx/conf.d/*.conf; do
        if [ -f "$config" ]; then
            sed -i 's/^\(\s*fastcgi_cache\s\)/# \1/g' "$config"
            sed -i 's/^\(\s*fastcgi_cache_valid\s\)/# \1/g' "$config"
            sed -i 's/^\(\s*fastcgi_cache_bypass\s\)/# \1/g' "$config"
            sed -i 's/^\(\s*fastcgi_no_cache\s\)/# \1/g' "$config"
        fi
    done
    echo "FastCGI cache disabled for troubleshooting"
else
    echo "FastCGI cache enabled"
fi

# Start Nginx
exec "$@" 