#!/bin/bash
# Multi-Site WordPress Docker Environment - Site Management Script
# This script helps manage existing WordPress sites (list, remove, etc.)

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

# Function to list all sites
list_sites() {
    print_cyan "=========================================="
    print_cyan "Active WordPress Sites"
    print_cyan "=========================================="
    echo ""

    if [ ! -d "sites" ] || [ -z "$(ls -A sites 2>/dev/null)" ]; then
        print_yellow "No sites found."
        echo ""
        print_cyan "Create a new site with: ./new-site.sh"
        return
    fi

    # List sites
    for site_dir in sites/*/; do
        if [ -d "$site_dir" ]; then
            domain=$(basename "$site_dir")

            # Check if config exists
            if [ -f "config/nginx/conf.d/${domain}.conf" ]; then
                config_status="✓"
            else
                config_status="✗"
            fi

            # Check if SSL cert exists
            if [ -f "config/nginx/ssl/${domain}.crt" ]; then
                ssl_status="✓"
            else
                ssl_status="✗"
            fi

            # Check if WordPress is installed
            if [ -f "${site_dir}wp-config.php" ]; then
                wp_status="✓"
            else
                wp_status="✗"
            fi

            # Get database name from wp-config.php if it exists
            if [ -f "${site_dir}wp-config.php" ]; then
                db_name=$(grep "DB_NAME" "${site_dir}wp-config.php" | cut -d "'" -f 4)
            else
                db_name="N/A"
            fi

            print_green "Domain: $domain"
            echo "  Nginx Config: $config_status"
            echo "  SSL Cert:     $ssl_status"
            echo "  WordPress:    $wp_status"
            echo "  Database:     $db_name"
            echo "  URL:          https://$domain"
            echo ""
        fi
    done
}

# Function to remove a site
remove_site() {
    local domain=$1

    if [ -z "$domain" ]; then
        print_red "Error: Domain name required"
        echo "Usage: $0 remove <domain>"
        return 1
    fi

    # Check if site exists
    if [ ! -d "sites/${domain}" ]; then
        print_red "Error: Site not found: $domain"
        return 1
    fi

    print_yellow "=========================================="
    print_yellow "Remove Site: $domain"
    print_yellow "=========================================="
    echo ""
    print_red "WARNING: This will permanently delete:"
    echo "  - WordPress files in sites/${domain}/"
    echo "  - Nginx configuration"
    echo "  - SSL certificates"
    echo "  - Database and all data"
    echo ""

    read -p "Are you sure you want to remove $domain? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        print_yellow "Removal cancelled."
        return 0
    fi

    # Get database name from wp-config.php
    if [ -f "sites/${domain}/wp-config.php" ]; then
        db_name=$(grep "DB_NAME" "sites/${domain}/wp-config.php" | cut -d "'" -f 4)
        db_user=$(grep "DB_USER" "sites/${domain}/wp-config.php" | cut -d "'" -f 4)

        # Load environment variables
        if [ -f ".env" ]; then
            set -a
            source .env
            set +a
        fi

        # Remove database
        print_cyan "Removing database: $db_name..."
        local container_name="${COMPOSE_PROJECT_NAME}-mariadb"
        local root_password="${MYSQL_ROOT_PASSWORD}"

        docker exec -i "$container_name" mariadb -uroot -p"$root_password" << EOF
DROP DATABASE IF EXISTS \`$db_name\`;
DROP USER IF EXISTS '$db_user'@'%';
FLUSH PRIVILEGES;
EOF

        if [ $? -eq 0 ]; then
            print_green "Database removed: $db_name"
        else
            print_red "Failed to remove database"
        fi
    fi

    # Remove WordPress files
    print_cyan "Removing WordPress files..."
    rm -rf "sites/${domain}"
    print_green "WordPress files removed"

    # Remove Nginx config
    if [ -f "config/nginx/conf.d/${domain}.conf" ]; then
        print_cyan "Removing Nginx configuration..."
        rm -f "config/nginx/conf.d/${domain}.conf"
        rm -f "config/nginx/processed/${domain}.conf"
        print_green "Nginx configuration removed"
    fi

    # Remove SSL certificates
    if [ -f "config/nginx/ssl/${domain}.crt" ]; then
        print_cyan "Removing SSL certificates..."
        rm -f "config/nginx/ssl/${domain}.crt"
        rm -f "config/nginx/ssl/${domain}.key"
        print_green "SSL certificates removed"
    fi

    # Reload Nginx
    print_cyan "Reloading Nginx..."
    docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx

    # Remove hosts entry
    print_cyan "Removing hosts entry..."
    if grep -q "$domain" /etc/hosts 2>/dev/null; then
        sudo sed -i "/$domain/d" /etc/hosts
        print_green "Hosts entry removed"
    fi

    echo ""
    print_green "=========================================="
    print_green "Site removed successfully: $domain"
    print_green "=========================================="
}

# Function to show site details
show_site() {
    local domain=$1

    if [ -z "$domain" ]; then
        print_red "Error: Domain name required"
        echo "Usage: $0 show <domain>"
        return 1
    fi

    if [ ! -d "sites/${domain}" ]; then
        print_red "Error: Site not found: $domain"
        return 1
    fi

    print_cyan "=========================================="
    print_cyan "Site Details: $domain"
    print_cyan "=========================================="
    echo ""

    # Get WordPress config details
    if [ -f "sites/${domain}/wp-config.php" ]; then
        db_name=$(grep "DB_NAME" "sites/${domain}/wp-config.php" | cut -d "'" -f 4)
        db_user=$(grep "DB_USER" "sites/${domain}/wp-config.php" | cut -d "'" -f 4)
        db_host=$(grep "DB_HOST" "sites/${domain}/wp-config.php" | cut -d "'" -f 4)

        print_green "WordPress Configuration:"
        echo "  Domain:    $domain"
        echo "  URL:       https://$domain"
        echo "  Admin URL: https://$domain/wp-admin"
        echo ""

        print_green "Database Configuration:"
        echo "  Database:  $db_name"
        echo "  User:      $db_user"
        echo "  Host:      $db_host"
        echo ""

        print_green "File Locations:"
        echo "  WordPress: sites/${domain}/"
        echo "  Nginx:     config/nginx/conf.d/${domain}.conf"
        echo "  SSL Cert:  config/nginx/ssl/${domain}.crt"
        echo "  SSL Key:   config/nginx/ssl/${domain}.key"
        echo ""
    else
        print_red "WordPress not installed or wp-config.php not found"
    fi
}

# Main script
case "${1:-list}" in
    list)
        list_sites
        ;;
    remove)
        remove_site "$2"
        ;;
    show)
        show_site "$2"
        ;;
    help|--help|-h)
        print_cyan "Multi-Site WordPress Management"
        print_cyan "================================"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  list              List all sites (default)"
        echo "  show <domain>     Show detailed information about a site"
        echo "  remove <domain>   Remove a site completely"
        echo "  help              Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 show mysite.local"
        echo "  $0 remove mysite.local"
        ;;
    *)
        print_red "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
