#!/bin/bash

# WP-CLI wrapper script for High-Performance-Docker-WordPress
# This script can be copied to any site directory and will automatically
# determine the correct path for WP-CLI commands.

# Determine the site path based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if we're in the sites directory structure
if [[ "$SCRIPT_DIR" =~ /sites/([^/]+) ]]; then
    # We're in a multi-site directory
    SITE_DOMAIN="${BASH_MATCH[1]}"
    WP_PATH="/var/www/html/sites/${SITE_DOMAIN}"
    echo "Running WP-CLI for site: ${SITE_DOMAIN}"
elif [[ "$SCRIPT_DIR" =~ /wordpress/?$ ]]; then
    # We're in the default wordpress directory
    WP_PATH="/var/www/html"
    echo "Running WP-CLI for default WordPress installation"
else
    # Assume we're in the project root
    WP_PATH="/var/www/html"
    echo "Running WP-CLI for default WordPress installation"
fi

# Execute WP-CLI command with all provided arguments
docker compose exec wordpress wp --allow-root --path="${WP_PATH}" "$@"
