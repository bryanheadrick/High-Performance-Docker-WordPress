# WordPress Docker Development Environment Setup Script
# This script sets up a new WordPress local development environment

# Function to create a self-signed SSL certificate
function CreateSelfSignedCertificate {
    param (
        [string]$domain,
        [string]$outputPath
    )

    # Ensure the SSL directory exists
    if (-not (Test-Path $outputPath)) {
        New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
    }

    # Create OpenSSL configuration file
    $opensslConfig = @"
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
"@

    # Write OpenSSL config to a temporary file
    $configPath = "$env:TEMP\openssl.cnf"
    $opensslConfig | Out-File -FilePath $configPath -Encoding ASCII

    # Generate private key and certificate
    Write-Host "Generating SSL certificate for $domain..."
    Start-Process -FilePath "openssl" -ArgumentList "req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout `"$outputPath\site.key`" -out `"$outputPath\site.crt`" -config `"$configPath`"" -NoNewWindow -Wait

    # Clean up
    Remove-Item $configPath -Force

    Write-Host "SSL certificate for $domain has been created at $outputPath"
}

# Function to set up the WordPress environment
function SetupWordPressEnvironment {
    param (
        [Parameter(Mandatory = $true)]
        [string]$projectName,
        [Parameter(Mandatory = $true)]
        [string]$domain,
        [Parameter(Mandatory = $false)]
        [string]$phpVersion = "8.3"
    )

    # Create directory structure
    $directories = @(
        "config/nginx/conf.d",
        "config/nginx/ssl",
        "config/nginx/fastcgi_cache",
        "config/nginx/proxy_cache",
        "config/php",
        "config/mysql/conf.d",
        "config/mysql/initdb.d",
        "config/redis",
        "config/monit/conf.d",
        "logs/nginx",
        "logs/php",
        "logs/mysql",
        "wordpress"
    )
    
    # Ensure proper permissions for log directories
    $logDirectories = @(
        "logs/nginx",
        "logs/php",
        "logs/mysql"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            Write-Host "Creating directory: $dir"
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    # Set proper permissions for log directories
    foreach ($logDir in $logDirectories) {
        Write-Host "Setting permissions for: $logDir"
        # In Windows, we don't need to change permissions the same way as in Linux,
        # but we ensure the directory exists and is accessible
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
    }

    # Create .env file from template
    $envContent = Get-Content ".env.template" -Raw
    $envContent = $envContent -replace "COMPOSE_PROJECT_NAME=wp-local", "COMPOSE_PROJECT_NAME=$projectName"
    $envContent = $envContent -replace "DOMAIN_NAME=project-name.local", "DOMAIN_NAME=$domain"
    $envContent = $envContent -replace "PHP_VERSION=8.3", "PHP_VERSION=$phpVersion"
    $envContent | Out-File -FilePath ".env" -Encoding ASCII

    # Create Nginx site configuration from template
    $siteConfTemplate = Get-Content "config/nginx/conf.d/site.conf.template" -Raw
    $siteConfTemplate = $siteConfTemplate -replace "\`${DOMAIN_NAME}", $domain
    $siteConfTemplate | Out-File -FilePath "config/nginx/conf.d/site.conf" -Encoding ASCII

    # Create SSL certificate
    CreateSelfSignedCertificate -domain $domain -outputPath "config/nginx/ssl"

    # Add hosts entry
    $hostsPath = "$env:windir\System32\drivers\etc\hosts"
    $hostsContent = Get-Content $hostsPath -Raw
    if (-not ($hostsContent -match $domain)) {
        Write-Host "Adding hosts entry for $domain"
        Add-Content -Path $hostsPath -Value "`n127.0.0.1`t$domain" -Force
    }

    Write-Host "Environment setup completed for $domain with PHP $phpVersion"
    Write-Host "To start the environment, run: docker-compose up -d"
}

# Main script execution
Write-Host "WordPress Docker Development Environment Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Get user inputs
$projectName = Read-Host "Enter project name (lowercase, no spaces)"
$domain = Read-Host "Enter domain name (e.g., myproject.local)"

# Validate domain ends with .local
if (-not $domain.EndsWith(".local")) {
    $domain = "$domain.local"
    Write-Host "Domain adjusted to: $domain" -ForegroundColor Yellow
}

# Get PHP version
$phpVersionOptions = @("7.4", "8.0", "8.1", "8.2", "8.3")
Write-Host "Select PHP version:"
for ($i = 0; $i -lt $phpVersionOptions.Count; $i++) {
    Write-Host "$($i+1). $($phpVersionOptions[$i])"
}
$phpVersionChoice = Read-Host "Enter choice number (default is 5 for PHP 8.3)"

if ([string]::IsNullOrEmpty($phpVersionChoice) -or -not ($phpVersionChoice -match "^[1-5]$")) {
    $phpVersionChoice = 5
}

$phpVersion = $phpVersionOptions[$phpVersionChoice - 1]

# Confirm settings
Write-Host ""
Write-Host "Setup Configuration:" -ForegroundColor Green
Write-Host "Project Name: $projectName"
Write-Host "Domain: $domain"
Write-Host "PHP Version: $phpVersion"
Write-Host ""

$confirm = Read-Host "Continue with these settings? (Y/n)"
if ($confirm -eq "n" -or $confirm -eq "N") {
    Write-Host "Setup cancelled." -ForegroundColor Red
    exit
}

# Run the setup
SetupWordPressEnvironment -projectName $projectName -domain $domain -phpVersion $phpVersion

# Check if Docker is running
try {
    docker info | Out-Null
    $dockerRunning = $true
} catch {
    $dockerRunning = $false
}

if ($dockerRunning) {
    $startDocker = Read-Host "Start Docker containers now? (Y/n)"
    if ($startDocker -ne "n" -and $startDocker -ne "N") {
        docker-compose up -d
        Write-Host "Docker containers started. WordPress is available at https://$domain" -ForegroundColor Green
        Write-Host "You may need to accept the self-signed certificate in your browser." -ForegroundColor Yellow
    } else {
        Write-Host "You can start the containers later with: docker-compose up -d" -ForegroundColor Yellow
    }
} else {
    Write-Host "Docker doesn't appear to be running. Start Docker and then run: docker-compose up -d" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Cyan