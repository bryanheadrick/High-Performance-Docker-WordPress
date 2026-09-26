#!/bin/bash
# Multi-Site WordPress Docker Environment - New Site Provisioning Script
# This script creates a new WordPress site with its own domain, database, and SSL certificate

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || {
    echo "Error: Could not change to script directory: $SCRIPT_DIR"
    exit 1
}

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

# Non-interactive flag parsing
NON_INTERACTIVE=false
ARG_DOMAIN=""
ARG_DB_NAME=""
ARG_DB_USER=""
ARG_DB_PASSWORD=""
ARG_ADMIN_USER=""
ARG_ADMIN_PASSWORD=""
ARG_ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --domain)
            ARG_DOMAIN="$2"
            shift 2
            ;;
        --db-name)
            ARG_DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            ARG_DB_USER="$2"
            shift 2
            ;;
        --db-password)
            ARG_DB_PASSWORD="$2"
            shift 2
            ;;
        --admin-user)
            ARG_ADMIN_USER="$2"
            shift 2
            ;;
        --admin-password)
            ARG_ADMIN_PASSWORD="$2"
            shift 2
            ;;
        --admin-email)
            ARG_ADMIN_EMAIL="$2"
            shift 2
            ;;
        *)
            print_red "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# Function to check if mkcert is installed
check_mkcert() {
    if ! command -v mkcert &> /dev/null; then
        print_yellow "mkcert is not installed. Installing now..."

        # Detect OS and install mkcert
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            print_cyan "Installing mkcert on Linux..."
            curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
            chmod +x mkcert-v*-linux-amd64
            sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            print_cyan "Installing mkcert on macOS..."
            if command -v brew &> /dev/null; then
                brew install mkcert
            else
                print_red "Homebrew not found. Please install Homebrew first: https://brew.sh"
                exit 1
            fi
        else
            print_red "Unsupported OS. Please install mkcert manually: https://github.com/FiloSottile/mkcert"
            exit 1
        fi

        # Install the local CA
        print_cyan "Installing local CA..."
        mkcert -install
        print_green "mkcert installed and CA configured successfully!"
    else
        print_green "mkcert is already installed"

        # Check if CA is installed
        if ! mkcert -CAROOT &> /dev/null; then
            print_yellow "Installing local CA..."
            mkcert -install
        fi
    fi
}

# Function to create SSL certificate using mkcert
create_mkcert_certificate() {
    local domain=$1
    local output_path=$2

    print_cyan "Creating trusted SSL certificate for $domain using mkcert..."

    # Ensure the SSL directory exists
    mkdir -p "$output_path"

    # Generate certificate with mkcert (use absolute/relative path instead of cd)
    mkcert -cert-file "$output_path/${domain}.crt" -key-file "$output_path/${domain}.key" "$domain" "*.${domain}"

    print_green "Trusted SSL certificate created for $domain"
}

# Function to create a fallback self-signed certificate (if mkcert fails)
create_self_signed_certificate() {
    local domain=$1
    local output_path=$2

    print_yellow "Creating self-signed SSL certificate for $domain..."

    # Ensure the SSL directory exists
    mkdir -p "$output_path"

    # Create OpenSSL configuration file
    cat > /tmp/openssl.cnf << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = Development
OU = Local Development
CN = $domain

[v3_req]
subjectAltName = @alt_names
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = $domain
DNS.2 = *.$domain
EOF

    # Generate private key and certificate
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$output_path/${domain}.key" \
        -out "$output_path/${domain}.crt" \
        -config /tmp/openssl.cnf

    # Clean up
    rm /tmp/openssl.cnf

    print_yellow "Self-signed SSL certificate created (browsers will show security warnings)"
}

# Function to create database for the new site
create_database() {
    local db_name=$1
    local db_user=$2
    local db_password=$3

    print_cyan "Creating database: $db_name..."

    # Get the container name from Docker Compose
    local container_name="${COMPOSE_PROJECT_NAME}-mariadb"

    # Check if MariaDB container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        print_red "Error: MariaDB container is not running. Please start Docker Compose first."
        return 1
    fi

    # Get root password - use environment variable if already loaded, otherwise read from .env
    local root_password="${MYSQL_ROOT_PASSWORD:-$(grep "^MYSQL_ROOT_PASSWORD=" .env 2>/dev/null | cut -d'=' -f2)}"

    if [ -z "$root_password" ]; then
        print_red "Error: Could not find MYSQL_ROOT_PASSWORD. Ensure .env file exists and contains MYSQL_ROOT_PASSWORD."
        return 1
    fi

    # Create database and user using mariadb command
    docker exec -i "$container_name" mariadb -uroot -p"$root_password" << EOF
CREATE DATABASE IF NOT EXISTS \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$db_user'@'%' IDENTIFIED BY '$db_password';
GRANT ALL PRIVILEGES ON \`$db_name\`.* TO '$db_user'@'%';
FLUSH PRIVILEGES;
EOF

    if [ $? -eq 0 ]; then
        print_green "Database created successfully: $db_name"
        return 0
    else
        print_red "Failed to create database"
        return 1
    fi
}

# Function to create Nginx site configuration
create_nginx_config() {
    local domain=$1

    print_cyan "Creating Nginx configuration for $domain..."

    # Ensure the config directory exists
    mkdir -p "config/nginx/conf.d"

    # Check if template exists
    if [ ! -f "config/nginx/conf.d/site.conf.template" ]; then
        print_red "Error: Template not found at config/nginx/conf.d/site.conf.template"
        print_yellow "Current directory: $(pwd)"
        print_yellow "Looking for: $(pwd)/config/nginx/conf.d/site.conf.template"
        return 1
    fi

    # Create site-specific config from template with both replacements
    sed -e "s/\${DOMAIN}/$domain/g" \
        -e "s|root /var/www/html;|root /var/www/html/sites/${domain};|g" \
        "config/nginx/conf.d/site.conf.template" > "config/nginx/conf.d/${domain}.conf"

    if [ $? -eq 0 ]; then
        print_green "Nginx configuration created: config/nginx/conf.d/${domain}.conf"
        return 0
    else
        print_red "Failed to create Nginx configuration"
        return 1
    fi
}

# Function to create WordPress directory structure
create_wordpress_directory() {
    local domain=$1

    print_cyan "Creating WordPress directory for $domain..."

    local site_dir="sites/${domain}"

    if [ -d "$site_dir" ]; then
        print_yellow "Warning: Directory $site_dir already exists"
        if [ "$NON_INTERACTIVE" = true ]; then
            print_red "Error: site directory already exists and --non-interactive was passed"
            exit 1
        fi
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[yY]$ ]]; then
            print_yellow "Skipping directory creation"
            return 0
        fi
        rm -rf "$site_dir"
    fi

    mkdir -p "$site_dir"

    print_green "WordPress directory created: $site_dir"
}

# Function to add hosts entry
add_hosts_entry() {
    local domain=$1

    if grep -q "$domain" /etc/hosts; then
        print_yellow "Hosts entry for $domain already exists"
        return 0
    fi

    print_cyan "Adding hosts entry for $domain..."
    echo "127.0.0.1    $domain" | sudo tee -a /etc/hosts > /dev/null

    if [ $? -eq 0 ]; then
        print_green "Hosts entry added successfully"
        return 0
    else
        print_red "Failed to add hosts entry (may need sudo permissions)"
        return 1
    fi
}

# Function to install WordPress using WP-CLI
install_wordpress() {
    local domain=$1
    local db_name=$2
    local db_user=$3
    local db_password=$4
    local admin_user=$5
    local admin_password=$6
    local admin_email=$7

    print_cyan "Installing WordPress for $domain..."

    local container_name="${COMPOSE_PROJECT_NAME}-wordpress"
    local site_path="/var/www/html/sites/${domain}"

    # Create the site directory first with correct permissions
    print_cyan "Creating site directory..."
    docker exec "$container_name" mkdir -p "$site_path"
    docker exec "$container_name" chown -R www-data:www-data "$site_path"

    # Create WP-CLI cache directory to avoid warnings
    docker exec "$container_name" mkdir -p /var/www/.wp-cli/cache
    docker exec "$container_name" chown -R www-data:www-data /var/www/.wp-cli

    # Download WordPress core
    print_cyan "Downloading WordPress core..."
    docker exec --user www-data "$container_name" wp core download --path="$site_path"

    # Create wp-config.php
    print_cyan "Creating wp-config.php..."

    # Create the extra PHP configuration
    local extra_php="define('WP_REDIS_HOST', 'redis');
define('WP_CACHE', true);
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);"

    docker exec --user www-data "$container_name" wp config create \
        --path="$site_path" \
        --dbname="$db_name" \
        --dbuser="$db_user" \
        --dbpass="$db_password" \
        --dbhost="mariadb" \
        --extra-php="$extra_php"

    # Install WordPress
    print_cyan "Installing WordPress..."
    docker exec --user www-data "$container_name" wp core install \
        --path="$site_path" \
        --url="https://$domain" \
        --title="$domain" \
        --admin_user="$admin_user" \
        --admin_password="$admin_password" \
        --admin_email="$admin_email" \
        --skip-email

    if [ $? -ne 0 ]; then
        print_red "WordPress installation failed"
        return 1
    fi

    print_green "WordPress installed successfully!"

    # Install the wpstack page-abilities mu-plugin (create/update/get page + block validation
    # abilities exposed via mcp-adapter). Mu-plugins auto-load, no activation needed.
    print_cyan "Installing wpstack page abilities mu-plugin..."
    docker exec "$container_name" mkdir -p "$site_path/wp-content/mu-plugins"
    docker cp "config/mu-plugins/wpstack-page-abilities.php" \
        "$container_name:$site_path/wp-content/mu-plugins/wpstack-page-abilities.php"
    docker exec "$container_name" chown www-data:www-data \
        "$site_path/wp-content/mu-plugins/wpstack-page-abilities.php"

    return 0
}

# Main script execution
print_cyan "=========================================="
print_cyan "Multi-Site WordPress Environment"
print_cyan "New Site Provisioning"
print_cyan "=========================================="
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    print_red "Error: .env file not found. Please run setup.sh first."
    exit 1
fi

# Check if Nginx template exists
if [ ! -f "config/nginx/conf.d/site.conf.template" ]; then
    print_red "Error: Nginx template not found at config/nginx/conf.d/site.conf.template"
    print_yellow "Please ensure you have the complete project structure."
    exit 1
fi

# Load environment variables early - needed for Docker checks
set -a
source .env
set +a

# Check and install mkcert
check_mkcert

# Get user inputs
echo ""
print_cyan "Site Configuration"
print_cyan "------------------"
if [ "$NON_INTERACTIVE" = true ]; then
    domain="$ARG_DOMAIN"
    if [ -z "$domain" ]; then
        print_red "Error: --domain is required with --non-interactive"
        exit 1
    fi
else
    read -p "Enter domain name (e.g., mysite.local): " domain
fi

# Validate domain ends with .local
if [[ ! "$domain" =~ \.local$ ]]; then
    domain="${domain}.local"
    print_yellow "Domain adjusted to: $domain"
fi

# Generate default database name from domain
default_db_name=$(echo "$domain" | sed 's/\./_/g' | sed 's/-/_/g')
random_password=$(openssl rand -base64 16)

if [ "$NON_INTERACTIVE" = true ]; then
    db_name="${ARG_DB_NAME:-$default_db_name}"
    db_user="${ARG_DB_USER:-wp_${db_name}}"
    db_password="${ARG_DB_PASSWORD:-$random_password}"
else
    read -p "Enter database name [${default_db_name}]: " db_name
    db_name=${db_name:-$default_db_name}

    read -p "Enter database user [wp_${db_name}]: " db_user
    db_user=${db_user:-wp_${db_name}}

    read -p "Enter database password [${random_password}]: " db_password
    db_password=${db_password:-$random_password}
fi

echo ""
print_cyan "WordPress Admin Configuration"
print_cyan "------------------------------"
if [ "$NON_INTERACTIVE" = true ]; then
    admin_user="${ARG_ADMIN_USER:-admin}"
    admin_password="${ARG_ADMIN_PASSWORD:-admin}"
    admin_email="${ARG_ADMIN_EMAIL:-admin@${domain}}"
else
    read -p "Enter admin username [admin]: " admin_user
    admin_user=${admin_user:-admin}

    read -p "Enter admin password [admin]: " admin_password
    admin_password=${admin_password:-admin}

    read -p "Enter admin email [admin@${domain}]: " admin_email
    admin_email=${admin_email:-admin@${domain}}
fi

# Confirm settings
echo ""
print_green "Site Configuration Summary:"
echo "Domain:           $domain"
echo "Database Name:    $db_name"
echo "Database User:    $db_user"
echo "Database Password: $db_password"
echo "Admin Username:   $admin_user"
echo "Admin Password:   $admin_password"
echo "Admin Email:      $admin_email"
echo ""

if [ "$NON_INTERACTIVE" = true ]; then
    print_cyan "Non-interactive mode: proceeding without confirmation."
else
    read -p "Continue with these settings? (Y/n): " confirm
    if [[ "$confirm" =~ ^[nN]$ ]]; then
        print_red "Setup cancelled."
        exit 1
    fi
fi

# Check if Docker is running first (before doing anything else)
print_cyan "Checking Docker status..."
if ! docker info > /dev/null 2>&1; then
    print_red "Error: Docker is not running."
    print_yellow "Please start Docker Desktop and try again."
    exit 1
fi

# Check if Docker containers are running
containers_running=false
if docker ps --format '{{.Names}}' | grep -q "${COMPOSE_PROJECT_NAME}-wordpress" 2>/dev/null; then
    containers_running=true
    print_green "Docker containers are already running."
else
    print_yellow "Docker containers are not currently running."
    echo ""
    if [ "$NON_INTERACTIVE" = true ]; then
        start_containers="Y"
    else
        read -p "Would you like to start the Docker containers now? (Y/n): " start_containers
    fi

    if [[ "$start_containers" =~ ^[nN]$ ]]; then
        print_red "Cannot proceed without running containers. Please start them with 'docker compose up -d' and try again."
        exit 1
    fi

    print_cyan "Starting Docker containers..."
    if docker compose up -d; then
        print_green "Docker containers started successfully."
        containers_running=true

        # Wait for containers to be ready
        print_cyan "Waiting for containers to be ready..."
        sleep 10
    else
        print_red "Failed to start Docker containers. Please check docker-compose.yml and try again."
        exit 1
    fi
fi

# Create directory structure
print_cyan "Creating directory structure..."
mkdir -p sites
mkdir -p config/nginx/ssl

# Create WordPress directory
create_wordpress_directory "$domain"

# Create SSL certificate
if create_mkcert_certificate "$domain" "config/nginx/ssl"; then
    print_green "Using trusted mkcert certificate"
else
    print_yellow "mkcert failed, falling back to self-signed certificate"
    create_self_signed_certificate "$domain" "config/nginx/ssl"
fi

# Create Nginx configuration
create_nginx_config "$domain"

# Create database
if ! create_database "$db_name" "$db_user" "$db_password"; then
    print_red "Failed to create database. Exiting."
    exit 1
fi

# Reload Nginx to pick up new configuration
print_cyan "Reloading Nginx configuration..."
docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx

# Add hosts entry
add_hosts_entry "$domain"

# Install WordPress
if install_wordpress "$domain" "$db_name" "$db_user" "$db_password" "$admin_user" "$admin_password" "$admin_email"; then
    echo ""
    print_green "=========================================="
    print_green "Site created successfully!"
    print_green "=========================================="
    echo ""
    print_green "Site URL:      https://$domain"
    print_green "Admin URL:     https://$domain/wp-admin"
    print_green "Admin User:    $admin_user"
    print_green "Admin Pass:    $admin_password"
    echo ""
    print_green "MailHog (email testing): http://localhost:8025"
    echo ""

    if command -v mkcert &> /dev/null; then
        print_green "SSL: Trusted certificate (no browser warnings)"
    else
        print_yellow "SSL: Self-signed certificate (browser will show warnings)"
    fi
else
    print_red "Site creation completed with errors. Please check the output above."
    exit 1
fi
