# High-Performance WordPress Docker Development Environment

A powerful, optimized Docker Compose setup for WordPress local development with support for large database operations, file uploads, and built-in performance optimizations.

## Features

- **High Performance Stack**: Nginx, PHP-FPM, MariaDB, Redis
- **Performance Optimizations**:
  - Fastcgi cache
  - Redis object cache
  - Proxy cache
  - Brotli/Gzip compression
  - Opcache
- **Large File Handling**: Pre-configured for large file uploads (up to 512MB)
- **Database Optimizations**: Optimized MariaDB configuration for WordPress
- **Development Tools**: Self-signed SSL certificates, performance monitoring
- **Plugin Support**: Pre-configured for WooCommerce and Updraft Plus
- **Multiple PHP Versions**: Choose from PHP 7.4, 8.0, 8.1, 8.2, or 8.3

## Requirements

- Docker and Docker Compose
- For Windows: PowerShell
- For macOS: Terminal with Bash
- OpenSSL (for certificate generation)

## Quick Setup

### Windows

1. Run PowerShell as Administrator
2. Navigate to the project directory
3. Run the setup script:
   ```powershell
   .\setup.ps1
   ```
4. Follow the prompts to configure your environment

### macOS

1. Open Terminal
2. Navigate to the project directory
3. Make the setup script executable:
   ```bash
   chmod +x setup.sh
   ```
4. Run the setup script:
   ```bash
   ./setup.sh
   ```
5. Follow the prompts to configure your environment

## Manual Configuration

If you prefer to set up manually:

1. Copy `.env.template` to `.env` and adjust the settings
2. Create directories as needed (see setup scripts for structure)
3. Configure your Nginx site in `config/nginx/conf.d/`
4. Generate SSL certificates and place in `config/nginx/ssl/`
5. Add the domain to your hosts file
6. Start the containers: `docker-compose up -d`

## Customizing Performance

### PHP Settings

Edit `config/php/php.ini` for PHP settings, including:
- Memory limits
- Upload sizes
- Execution time
- Opcache configuration

### MySQL Settings

Edit `config/mysql/my.cnf` to adjust database performance:
- Buffer settings
- Connection limits
- Query cache settings

### Nginx Settings

Edit `config/nginx/nginx.conf` for web server performance:
- Worker processes
- Connection settings
- Cache configurations
- Compression settings

## Working with Multiple Projects

To create multiple project environments:

1. Create a new directory for each project
2. Copy this setup to each directory
3. Run the setup script in each directory with different domain names
4. Each environment will operate independently

## Switching PHP Versions

To switch PHP versions after setup:

1. Edit your `.env` file and change the `PHP_VERSION` value
2. Rebuild the WordPress container:
   ```bash
   docker-compose up -d --build wordpress
   ```

## Monitoring Performance

Access the Monit monitoring dashboard at `http://localhost:2812` (username: admin, password: monit)

Monit provides:
- Resource usage monitoring
- Process monitoring
- Service availability checks

## Troubleshooting

### Common Issues

- **Browser SSL Warnings**: Accept the self-signed certificate in your browser
- **Permission Issues**: Check folder permissions, containers run as www-data (UID 33)
- **Database Connection Errors**: Verify MariaDB container is running and credentials match in `.env`
- **Large File Upload Failures**: Check both PHP (`php.ini`) and Nginx timeouts

### Log Files

Logs are stored in the `logs/` directory:
- `logs/nginx/` - Web server logs
- `logs/php/` - PHP error logs
- `logs/mysql/` - Database logs

## License

This project is open-source and available under the MIT License.