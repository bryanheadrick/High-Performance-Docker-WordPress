#!/bin/bash
# Cleanup script for broken sites created before volume mount was working
# This script removes sites that were created when the ./sites volume wasn't properly mounted

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Print colored output
print_green() {
    echo -e "\033[0;32m$1\033[0m"
}

print_yellow() {
    echo -e "\033[0;33m$1\033[0m"
}

print_red() {
    echo -e "\033[0;31m$1\033[0m"
}

print_cyan() {
    echo -e "\033[0;36m$1\033[0m"
}

print_cyan "=========================================="
print_cyan "Cleanup Broken Sites"
print_cyan "=========================================="
echo ""

# Check if sites directory exists
if [ ! -d "sites" ]; then
    print_yellow "No sites directory found. Nothing to clean up."
    exit 0
fi

# Find all sites that have no WordPress installation (empty or missing wp-config.php)
broken_sites=()

for site_dir in sites/*/; do
    if [ -d "$site_dir" ]; then
        domain=$(basename "$site_dir")

        # Check if wp-config.php exists
        if [ ! -f "${site_dir}wp-config.php" ]; then
            broken_sites+=("$domain")
        fi
    fi
done

# If no broken sites found
if [ ${#broken_sites[@]} -eq 0 ]; then
    print_green "No broken sites found. All sites appear to be properly installed!"
    exit 0
fi

# Display broken sites
print_yellow "Found ${#broken_sites[@]} broken site(s):"
echo ""
for site in "${broken_sites[@]}"; do
    echo "  - $site"
done
echo ""

print_red "These sites have directories but no WordPress installation."
print_yellow "This typically happens when sites were created before the volume mount was configured."
echo ""

read -p "Do you want to remove these broken sites? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_yellow "Cleanup cancelled."
    exit 0
fi

echo ""
print_cyan "Removing broken sites..."
echo ""

# Load environment variables if needed for database cleanup
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Remove each broken site
for domain in "${broken_sites[@]}"; do
    print_cyan "Removing: $domain"

    # Remove directory
    if [ -d "sites/${domain}" ]; then
        rm -rf "sites/${domain}"
        print_green "  ✓ Removed directory"
    fi

    # Remove Nginx config
    if [ -f "config/nginx/conf.d/${domain}.conf" ]; then
        rm -f "config/nginx/conf.d/${domain}.conf"
        rm -f "config/nginx/processed/${domain}.conf"
        print_green "  ✓ Removed Nginx config"
    fi

    # Remove SSL certificates
    if [ -f "config/nginx/ssl/${domain}.crt" ]; then
        rm -f "config/nginx/ssl/${domain}.crt"
        rm -f "config/nginx/ssl/${domain}.key"
        print_green "  ✓ Removed SSL certificates"
    fi

    # Try to remove database (may not exist)
    if [ ! -z "$COMPOSE_PROJECT_NAME" ] && [ ! -z "$MYSQL_ROOT_PASSWORD" ]; then
        local container_name="${COMPOSE_PROJECT_NAME}-mariadb"
        local db_name=$(echo "$domain" | sed 's/\./_/g' | sed 's/-/_/g')

        # Check if container is running
        if docker ps --format '{{.Names}}' | grep -q "^${container_name}$" 2>/dev/null; then
            docker exec -i "$container_name" mariadb -uroot -p"$MYSQL_ROOT_PASSWORD" << EOF 2>/dev/null
DROP DATABASE IF EXISTS \`$db_name\`;
DROP USER IF EXISTS 'wp_${db_name}'@'%';
FLUSH PRIVILEGES;
EOF
            if [ $? -eq 0 ]; then
                print_green "  ✓ Removed database (if it existed)"
            fi
        fi
    fi

    # Remove hosts entry
    if grep -q "$domain" /etc/hosts 2>/dev/null; then
        sudo sed -i "/$domain/d" /etc/hosts 2>/dev/null
        if [ $? -eq 0 ]; then
            print_green "  ✓ Removed hosts entry"
        fi
    fi

    echo ""
done

# Reload Nginx if it's running
if docker ps --format '{{.Names}}' | grep -q "nginx" 2>/dev/null; then
    print_cyan "Reloading Nginx..."
    docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx
    print_green "  ✓ Nginx reloaded"
fi

echo ""
print_green "=========================================="
print_green "Cleanup Complete!"
print_green "=========================================="
echo ""
print_cyan "Removed ${#broken_sites[@]} broken site(s):"
for site in "${broken_sites[@]}"; do
    echo "  - $site"
done
echo ""
print_yellow "You can now create new sites with ./new-site.sh"
print_yellow "They will work properly with the volume mount configured."
