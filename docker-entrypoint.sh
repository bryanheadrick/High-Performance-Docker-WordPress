#!/bin/sh
set -e

# Create processed configurations directory
mkdir -p /etc/nginx/conf.d

# Process environment variables in Nginx configuration files
for file in /etc/nginx/conf.d.template/*.conf; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        envsubst '${DOMAIN_PENNY} ${DOMAIN_NAME}' < "$file" > "/etc/nginx/conf.d/$filename"
    fi
done

# Start Nginx
exec "$@" 