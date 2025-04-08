#!/bin/bash
# WordPress Docker Development Environment Setup Script for macOS
# This script sets up a new WordPress local development environment

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

# Function to create a self-signed SSL certificate
create_self_signed_certificate() {
    local domain=$1
    local output_path=$2

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
O = Organization
OU = Development
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
    echo "Generating SSL certificate for $domain..."
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$output_path/site.key" \
        -out "$output_path/site.crt" \
        -config /tmp/openssl.cnf

    # Clean up
    rm /tmp/openssl.cnf

    echo "SSL certificate for $domain has been created at $output_path"
}

# Function to set up the WordPress environment
setup_wordpress_environment() {
    local project_name=$1
    local domain=$2
    local php_version=$3

    # Create directory structure
    directories=(
        "config/nginx/conf.d"
        "config/nginx/ssl"
        "config/nginx/fastcgi_cache"
        "config/nginx/proxy_cache"
        "config/php"
        "config/mysql/conf.d"
        "config/mysql/initdb.d"
        "config/redis"
        "config/monit/conf.d"
        "logs/nginx"
        "logs/php"
        "logs/mysql"
        "wordpress"
    )
    
    # Ensure proper permissions for log directories
    log_directories=(
        "logs/nginx"
        "logs/php"
        "logs/mysql"
    )

    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done
    
    # Set proper permissions for log directories
    for log_dir in "${log_directories[@]}"; do
        echo "Setting permissions for: $log_dir"
        chmod -R 777 "$log_dir"
    done

    # Create .env file from template
    if [ -f ".env.template" ]; then
        cat .env.template | \
            sed "s/COMPOSE_PROJECT_NAME=wp-local/COMPOSE_PROJECT_NAME=$project_name/g" | \
            sed "s/DOMAIN_NAME=project-name.local/DOMAIN_NAME=$domain/g" | \
            sed "s/PHP_VERSION=8.3/PHP_VERSION=$php_version/g" > .env
    else
        print_red "Error: .env.template not found"
        exit 1
    fi

    # Create Nginx site configuration from template
    if [ -f "config/nginx/conf.d/site.conf.template" ]; then
        cat "config/nginx/conf.d/site.conf.template" | \
            sed "s/\${DOMAIN_NAME}/$domain/g" > "config/nginx/conf.d/$domain.conf"
    else
        print_red "Error: site.conf.template not found"
        exit 1
    fi

    # Create SSL certificate
    create_self_signed_certificate "$domain" "config/nginx/ssl"

    # Add hosts entry
    if ! grep -q "$domain" /etc/hosts; then
        echo "Adding hosts entry for $domain (will prompt for sudo password)"
        echo "127.0.0.1    $domain" | sudo tee -a /etc/hosts > /dev/null
    fi

    print_green "Environment setup completed for $domain with PHP $php_version"
    print_green "To start the environment, run: docker-compose up -d"
}

# Main script execution
print_cyan "WordPress Docker Development Environment Setup"
print_cyan "============================================="
echo ""

# Get user inputs
read -p "Enter project name (lowercase, no spaces): " project_name
read -p "Enter domain name (e.g., myproject.local): " domain

# Validate domain ends with .local
if [[ ! "$domain" =~ \.local$ ]]; then
    domain="${domain}.local"
    print_yellow "Domain adjusted to: $domain"
fi

# Get PHP version
php_version_options=("7.4" "8.0" "8.1" "8.2" "8.3")
echo "Select PHP version:"
for i in "${!php_version_options[@]}"; do
    echo "$((i+1)). ${php_version_options[$i]}"
done

read -p "Enter choice number (default is 5 for PHP 8.3): " php_version_choice

if [[ -z "$php_version_choice" ]] || ! [[ "$php_version_choice" =~ ^[1-5]$ ]]; then
    php_version_choice=5
fi

php_version=${php_version_options[$((php_version_choice-1))]}

# Confirm settings
echo ""
print_green "Setup Configuration:"
echo "Project Name: $project_name"
echo "Domain: $domain"
echo "PHP Version: $php_version"
echo ""

read -p "Continue with these settings? (Y/n): " confirm
if [[ "$confirm" =~ ^[nN]$ ]]; then
    print_red "Setup cancelled."
    exit 1
fi

# Run the setup
setup_wordpress_environment "$project_name" "$domain" "$php_version"

# Check if Docker is running
if docker info > /dev/null 2>&1; then
    read -p "Start Docker containers now? (Y/n): " start_docker
    if [[ ! "$start_docker" =~ ^[nN]$ ]]; then
        docker-compose up -d
        print_green "Docker containers started. WordPress is available at https://$domain"
        print_yellow "You may need to accept the self-signed certificate in your browser."
    else
        print_yellow "You can start the containers later with: docker-compose up -d"
    fi
else
    print_yellow "Docker doesn't appear to be running. Start Docker and then run: docker-compose up -d"
fi

echo ""
print_cyan "Setup complete!"