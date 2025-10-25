# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance WordPress Docker development environment optimized for large database operations, file uploads, and production-like performance. The stack uses Nginx with custom Brotli compression, PHP-FPM, MariaDB, Redis object caching, and Monit for monitoring.

## Architecture

### Service Stack

The environment consists of 5 Docker services defined in `docker-compose.yml`:

1. **nginx** - Custom-built Nginx with Brotli compression module
   - Built from `Dockerfile.nginx` (Alpine-based, compiles ngx_brotli from source)
   - Uses template-based config with environment variable substitution via `docker-entrypoint.sh`
   - Config templates in `config/nginx/conf.d.template/` are processed to `config/nginx/processed/`
   - Implements FastCGI cache (`config/nginx/fastcgi_cache/`) and proxy cache

2. **wordpress** - WordPress with PHP-FPM
   - Built from `Dockerfile.wordpress` with variable PHP version support (7.4-8.3)
   - Includes WP-CLI and Composer pre-installed
   - Redis object cache integration via `WORDPRESS_CONFIG_EXTRA` environment variable

3. **mariadb** - Database with custom optimizations
   - Uses volume mount `db_data` for persistence
   - Custom config at `config/mysql/my.cnf`
   - Init scripts can be placed in `config/mysql/initdb.d/`
   - Max packet size set to 256M for large operations

4. **redis** - Object cache
   - Alpine-based with custom config at `config/redis/redis.conf`

5. **monit** - Monitoring service
   - Template-based config similar to Nginx
   - Web interface on port 2812 (admin/monit)
   - Has Docker socket access for container monitoring

### Configuration System

The project uses a two-tier configuration approach:

1. **Environment Variables** - Defined in `.env` (created from `.env.template`)
   - `COMPOSE_PROJECT_NAME` - Project namespace
   - `DOMAIN_NAME` - Domain for site config
   - `PHP_VERSION` - PHP version selection (7.4, 8.0, 8.1, 8.2, 8.3)
   - Database credentials

2. **Template Processing** - Nginx and Monit configs use `envsubst` for variable substitution
   - Templates in `.template` directories are processed at container startup
   - Variables like `${DOMAIN_NAME}` are replaced in runtime

### Volume Mounts

Critical volumes that persist data and configuration:
- `./wordpress:/var/www/html` - WordPress installation
- `db_data` - MariaDB data (named volume)
- `./logs/nginx`, `./logs/php` - Application logs
- `./config/*` - Service configurations

## Essential Commands

### Initial Setup

Run the appropriate setup script based on your platform:

```bash
# macOS/Linux
chmod +x setup.sh
./setup.sh

# Windows PowerShell (as Administrator)
.\setup.ps1
```

These scripts will:
- Create `.env` from template
- Generate directory structure
- Create self-signed SSL certificates
- Generate Nginx site config
- Update hosts file
- Start containers

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild specific service (e.g., after changing PHP version)
docker-compose up -d --build wordpress

# View logs
docker-compose logs -f [service_name]

# Restart specific service
docker-compose restart [service_name]
```

### WordPress CLI Operations

WP-CLI is pre-installed in the wordpress container:

```bash
# Execute WP-CLI commands
docker-compose exec wordpress wp --allow-root [command]

# Examples
docker-compose exec wordpress wp --allow-root plugin list
docker-compose exec wordpress wp --allow-root cache flush
```

### Composer Operations

Composer is pre-installed for plugin/theme dependency management:

```bash
docker-compose exec wordpress composer [command]
```

### Database Operations

```bash
# Access MariaDB CLI
docker-compose exec mariadb mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}

# Import database
docker-compose exec -T mariadb mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < backup.sql

# Export database
docker-compose exec mariadb mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > backup.sql
```

### Cache Management

```bash
# Clear FastCGI cache (Nginx)
docker-compose exec nginx rm -rf /var/run/nginx-cache/*

# Clear Redis object cache
docker-compose exec redis redis-cli FLUSHALL

# Restart PHP-FPM to clear opcache
docker-compose restart wordpress
```

## Key Implementation Details

### PHP Version Switching

To change PHP versions:
1. Update `PHP_VERSION` in `.env` (values: 7.4, 8.0, 8.1, 8.2, 8.3)
2. Rebuild wordpress container: `docker-compose up -d --build wordpress`
3. The Dockerfile uses build arg `${PHP_VERSION}` which expands to `wordpress:php${PHP_VERSION}-fpm` (e.g., `wordpress:php8.3-fpm`)

### Nginx Configuration Changes

When modifying Nginx configs:
- Templates are in `config/nginx/conf.d/` (not `.template` subdirectory)
- Site-specific config typically named `{DOMAIN_NAME}.conf`
- After changes, restart: `docker-compose restart nginx`
- Processed configs appear in `config/nginx/processed/`

### Performance Tuning

Key config files for optimization:
- `config/php/php.ini` - Memory limits, opcache, upload sizes
- `config/php/www.conf` - PHP-FPM pool settings
- `config/mysql/my.cnf` - Database buffer pools, query cache
- `config/nginx/nginx.conf` - Worker processes, connections, cache settings
- `uploads.ini` - PHP upload-specific settings (mounted separately)

### SSL Certificates

Self-signed certs generated by setup scripts are placed in:
- `config/nginx/ssl/selfsigned.crt`
- `config/nginx/ssl/selfsigned.key`

For production, replace with valid certificates in same location.

### Redis Integration

WordPress is configured for Redis object cache via environment variable in `docker-compose.yml`:
```
WORDPRESS_CONFIG_EXTRA=define('WP_REDIS_HOST', 'redis');define('WP_CACHE', true);
```

Requires Redis object cache plugin to be installed and activated.

### Monit Monitoring

Access dashboard at `http://localhost:2812`
- Default credentials: admin/monit
- Monitors all Docker containers via socket mount
- Config in `config/monit/monitrc` and `config/monit/conf.d/`

## Development Workflow

1. Make code changes in `./wordpress` directory (mounted into container)
2. Changes are immediately reflected (no rebuild needed for PHP/WordPress files)
3. For config changes (PHP, Nginx, MySQL), restart the appropriate service
4. For Dockerfile changes, rebuild the specific service
5. Monitor logs in `./logs/` directories for debugging

## Common Troubleshooting

- **Nginx fails to start**: Check processed configs in `config/nginx/processed/` for syntax errors
- **WordPress can't connect to database**: Verify MariaDB container is healthy and credentials in `.env` match
- **Upload failures**: Check both `config/php/php.ini` and `uploads.ini` for size limits, and Nginx client_max_body_size
- **Permission errors**: Containers run as www-data (UID 33); ensure `./wordpress` directory has appropriate permissions
- **Port conflicts**: Default ports are 80, 443, 3306, 2812; modify in `docker-compose.yml` if conflicts exist
