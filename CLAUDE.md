# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a high-performance WordPress Docker development environment optimized for large database operations, file uploads, and production-like performance. The stack uses Nginx with custom Brotli compression, PHP-FPM, MariaDB, Redis object caching, and Monit for monitoring.

**Multi-Site Support**: This environment supports running multiple WordPress sites concurrently, each with its own domain, database, and SSL certificate. Sites can be created, managed, and removed using the provided management scripts.

## Architecture

### Service Stack

The environment consists of 6 Docker services defined in `docker-compose.yml`:

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

5. **mailhog** - Email testing tool
   - Captures all emails sent by WordPress
   - Web UI on port 8025 for viewing emails
   - SMTP server on port 1025
   - WordPress configured to use msmtp to send to MailHog

6. **monit** - Monitoring service
   - Template-based config similar to Nginx
   - Web interface on port 2812 (admin/monit)
   - Has Docker socket access for container monitoring

### Configuration System

The project uses a two-tier configuration approach:

1. **Environment Variables** - Defined in `.env` (created from `.env.template`)
   - `COMPOSE_PROJECT_NAME` - Project namespace
   - `DOMAIN` - Domain for site config (passed to Nginx)
   - `PHP_VERSION` - PHP version selection (7.4, 8.0, 8.1, 8.2, 8.3)
   - Database credentials

2. **Template Processing** - Nginx and Monit configs use `envsubst` for variable substitution
   - Templates in `.template` directories are processed at container startup
   - Variables like `${DOMAIN}` are replaced in runtime

### Volume Mounts

Critical volumes that persist data and configuration:
- `./wordpress:/var/www/html` - Default WordPress installation
- `./sites:/var/www/html/sites` - Multi-site WordPress installations
- `db_data` - MariaDB data (named volume)
- `./logs/nginx`, `./logs/php` - Application logs
- `./config/*` - Service configurations

### Multi-Site Architecture

The environment supports multiple concurrent WordPress sites:
- Each site has its own directory in `./sites/{domain}/`
- Each site has its own database within the shared MariaDB container
- Each site has its own Nginx configuration file in `config/nginx/conf.d/{domain}.conf`
- Each site has its own SSL certificate (mkcert trusted or self-signed) in `config/nginx/ssl/{domain}.crt|key`
- All sites share the same PHP-FPM, Redis, and MailHog services
- Sites are isolated at the file and database level

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

### Multi-Site Management

#### Creating a New Site

Use the `new-site.sh` script to create additional WordPress sites:

```bash
chmod +x new-site.sh
./new-site.sh
```

The script will:
- Install and configure mkcert (if not already installed) for trusted SSL certificates
- Create a new site directory in `sites/{domain}/`
- Generate a trusted SSL certificate (or self-signed as fallback)
- Create site-specific Nginx configuration
- Create an isolated database and user
- Install WordPress with WP-CLI
- Update /etc/hosts
- Reload Nginx configuration

**mkcert Benefits**:
- Certificates are automatically trusted by your browser (no security warnings)
- Local CA is installed in your system's trust store
- Works across Chrome, Firefox, Safari, and other browsers
- Automatic installation on first run

#### Managing Existing Sites

Use the `manage-sites.sh` script to view and manage sites:

```bash
chmod +x manage-sites.sh

# List all sites
./manage-sites.sh list

# Show detailed site information
./manage-sites.sh show mysite.local

# Remove a site completely
./manage-sites.sh remove mysite.local

# Show help
./manage-sites.sh help
```

The `remove` command will:
- Delete WordPress files
- Drop the database
- Remove Nginx configuration
- Delete SSL certificates
- Remove hosts entry

#### Programmatic Access: `wpstack` CLI, MCP Server, Web UI

The `packages/` workspace provides a `wpstack` CLI, an MCP server, and a local web UI on top of `new-site.sh` / `manage-sites.sh`, for AI-agent and browser-based site management. See the "Site Manager" section in `README.md` for setup and usage. When editing site-management logic, `packages/core` is the single source of truth that both `new-site.sh` non-interactive flags and every client (CLI, MCP, web UI) depend on.

#### Two Separate MCP Layers — Don't Conflate Them

This environment has **two distinct MCP servers** that serve different purposes:

1. **`wpstack` MCP server** (`packages/mcp-server`) — infrastructure-level. Lists/creates/removes sites and starts/stops the Docker stack. It has no knowledge of a site's WordPress content, users, or REST API, and no per-site credentials.
2. **Per-site WordPress MCP server** — each individual WordPress install (e.g. `catmanstudios.local`) can expose its own MCP endpoint via the `mcp-adapter` plugin (WordPress Abilities API → MCP). This is what lets an AI agent read/write that specific site's content (posts, CRM data, etc.), authenticated as a real WordPress user via an Application Password. See the `wp-mcp-server` skill for the full ability-registration and troubleshooting reference.

**Per-site MCP endpoint**: `https://{domain}/wp-json/mcp/mcp-adapter-default-server` (default server — exposes `discover-abilities`, `get-ability-info`, `execute-ability` meta-tools; requires the `mcp-adapter` plugin active on that site).

**Prerequisites per site**:
- `mcp-adapter` plugin installed and active (`wp plugin activate mcp-adapter --path=sites/{domain}`)
- Site served over HTTPS (all multi-sites here are, via mkcert)
- An Application Password for a WordPress user on that site (`wp user application-password create {user} {name} --porcelain --path=sites/{domain}`)

**Credential storage**: each site's MCP credentials live in a gitignored per-site file, `sites/{domain}/.mcp-credentials` (plain `KEY=value`, colocated with that site's `wp-config.php`):
```
WP_MCP_URL=https://{domain}/wp-json/mcp/mcp-adapter-default-server
WP_MCP_USER={wp username or email}
WP_MCP_APP_PASSWORD={application password}
```
`/sites` is already fully gitignored; `.mcp-credentials` is also explicitly listed in `.gitignore` as defense-in-depth. Never commit these files. Prefer creating a scoped, low-privilege WordPress user/role for MCP access rather than reusing an administrator account when a site's ability set doesn't require full admin capabilities.

**Page create/edit abilities**: core WordPress + `mcp-adapter` only ship three read-only diagnostic abilities (`core/get-site-info`, `core/get-user-info`, `core/get-environment-info`) — no page CRUD exists out of the box. A per-site mu-plugin, `wp-content/mu-plugins/wpstack-page-abilities.php` (auto-loads, no activation needed), registers four additional abilities to fill this gap:
- `wpstack/create-page`, `wpstack/update-page`, `wpstack/get-page` — standard page CRUD via `wp_insert_post`/`wp_update_post`, taking serialized Gutenberg block markup as `content`.
- `wpstack/validate-blocks` — validates block markup before it's written: only core blocks from an allowlist (no `core/html`), no inline `style=""` or raw hex colors (use theme.json palette slugs), and full-width `core/group` sections must set `align:"full"`. `create-page`/`update-page` run this validation internally and reject on failure.

The tracked source of truth is `config/mu-plugins/wpstack-page-abilities.php`. `new-site.sh` automatically copies it into every new site's `wp-content/mu-plugins/` during `install_wordpress()`, so all future sites get these abilities with zero extra steps. It has also been backfilled onto every existing multi-site (`catmanstudios.local`, `bryanheadrick.local`, `catmanplugins.local`, `facetheperil.local`, `proposalgen.local`, `thepennylady.local`). If you edit the template, remember per-site copies under `sites/{domain}/wp-content/mu-plugins/` won't update themselves — recopy manually or via `docker cp`. These rules were adapted from studying WP Studio's "Build with WordPress" feature (a separate, proprietary Automattic tool) — only the block-composition *rules* were ported, no code or prose was copied.

### Container Management

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild specific service (e.g., after changing PHP version)
docker compose up -d --build wordpress

# View logs
docker compose logs -f [service_name]

# Restart specific service
docker compose restart [service_name]
```

### WordPress CLI Operations

WP-CLI is pre-installed in the wordpress container:

```bash
# Execute WP-CLI commands for default site
docker compose exec wordpress wp --allow-root [command]

# Execute WP-CLI commands for specific multi-site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/{domain} [command]

# Examples
docker compose exec wordpress wp --allow-root plugin list
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local plugin install redis-cache --activate
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local cache flush
```

### Composer Operations

Composer is pre-installed for plugin/theme dependency management:

```bash
docker compose exec wordpress composer [command]
```

### Database Operations

```bash
# Access MariaDB CLI
docker compose exec mariadb mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}

# Import database
docker compose exec -T mariadb mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < backup.sql

# Export database
docker compose exec mariadb mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > backup.sql
```

### Cache Management

```bash
# Clear FastCGI cache (Nginx)
docker compose exec nginx rm -rf /var/run/nginx-cache/*

# Clear Redis object cache
docker compose exec redis redis-cli FLUSHALL

# Restart PHP-FPM to clear opcache
docker compose restart wordpress
```

### Email Testing with MailHog

All emails sent by WordPress are captured by MailHog:

```bash
# Access MailHog web UI
http://localhost:8025

# Test email sending from WordPress CLI
docker compose exec wordpress wp --allow-root eval 'wp_mail("test@example.com", "Test Subject", "Test message");'
```

MailHog captures all outbound emails, preventing accidental sends during development.

## Key Implementation Details

### PHP Version Switching

To change PHP versions:
1. Update `PHP_VERSION` in `.env` (values: 7.4, 8.0, 8.1, 8.2, 8.3)
2. Rebuild wordpress container: `docker compose up -d --build wordpress`
3. The Dockerfile uses build arg `${PHP_VERSION}` which expands to `wordpress:php${PHP_VERSION}-fpm` (e.g., `wordpress:php8.3-fpm`)

### Nginx Configuration Changes

When modifying Nginx configs:
- Templates are in `config/nginx/conf.d/` (not `.template` subdirectory)
- Site-specific config typically named `{DOMAIN_NAME}.conf`
- After changes, restart: `docker compose restart nginx`
- Processed configs appear in `config/nginx/processed/`

### Performance Tuning

Key config files for optimization:
- `config/php/php.ini` - Memory limits, opcache, upload sizes
- `config/php/www.conf` - PHP-FPM pool settings
- `config/mysql/my.cnf` - Database buffer pools, query cache
- `config/nginx/nginx.conf` - Worker processes, connections, cache settings
- `uploads.ini` - PHP upload-specific settings (mounted separately)

### SSL Certificates

The environment supports two types of SSL certificates:

1. **mkcert (Recommended for Development)**:
   - Automatically installed by `new-site.sh` if not present
   - Creates trusted certificates recognized by all major browsers
   - No browser security warnings
   - Certificates stored as `config/nginx/ssl/{domain}.crt` and `config/nginx/ssl/{domain}.key`
   - Local CA installed in system trust store

2. **Self-signed (Fallback)**:
   - Used if mkcert installation fails
   - Browsers will show security warnings
   - Same storage location as mkcert certificates

For production, replace with valid certificates from a trusted CA in the same location.

### Redis Integration

WordPress is configured for Redis object cache via environment variable in `docker compose.yml`:
```
WORDPRESS_CONFIG_EXTRA=define('WP_REDIS_HOST', 'redis');define('WP_CACHE', true);
```

Requires Redis object cache plugin to be installed and activated.

### Monit Monitoring

Access dashboard at `http://localhost:2812`
- Default credentials: admin/monit
- Monitors all Docker containers via socket mount
- Config in `config/monit/monitrc` and `config/monit/conf.d/`

### Email Configuration (MailHog)

WordPress is configured to send all emails through MailHog for testing:
- PHP's `sendmail_path` points to msmtp (`config/php/php.ini:53`)
- msmtp configuration is in the WordPress container at `/etc/msmtprc`
- Configuration set during Docker build in `Dockerfile.wordpress:24-30`
- Access MailHog web UI at `http://localhost:8025` to view captured emails
- No emails will be sent to real addresses during development

## Development Workflow

### Single Site Workflow

1. Make code changes in `./wordpress` directory (mounted into container)
2. Changes are immediately reflected (no rebuild needed for PHP/WordPress files)
3. For config changes (PHP, Nginx, MySQL), restart the appropriate service
4. For Dockerfile changes, rebuild the specific service
5. Monitor logs in `./logs/` directories for debugging

### Multi-Site Workflow

1. **Create a new site**: Run `./new-site.sh` and follow the prompts
2. **Develop**: Make code changes in `./sites/{domain}/` directory
3. **Manage**: Use `./manage-sites.sh` to list, view, or remove sites
4. **WP-CLI**: Use `--path=/var/www/html/sites/{domain}` flag for site-specific commands
5. **Database**: Each site has its own isolated database
6. **Logs**: All sites share the same Nginx and PHP logs in `./logs/`

## Common Troubleshooting

### General Issues

- **Nginx fails to start**: Check processed configs in `config/nginx/processed/` for syntax errors
- **WordPress can't connect to database**: Verify MariaDB container is healthy and credentials in `.env` match
- **Upload failures**: Check both `config/php/php.ini` and `uploads.ini` for size limits, and Nginx client_max_body_size
- **Permission errors**: Containers run as www-data (UID 33); ensure `./wordpress` and `./sites/` directories have appropriate permissions
- **Port conflicts**: Default ports are 80, 443, 3306, 2812, 8025, 1025; modify in `docker compose.yml` if conflicts exist
- **Emails not captured by MailHog**: Ensure wordpress container was rebuilt after adding MailHog configuration

### Multi-Site Issues

- **Site not accessible**: Verify the domain is in `/etc/hosts` and Nginx config exists in `config/nginx/conf.d/{domain}.conf`
- **SSL certificate warnings**: If using mkcert, ensure `mkcert -install` was run successfully. Check certificate files exist in `config/nginx/ssl/`
- **Database connection errors**: Verify database was created using `./manage-sites.sh show {domain}` to see database details
- **WordPress installation fails**: Ensure Docker containers are running before running `new-site.sh`
- **Changes not reflected**: Restart Nginx with `docker compose restart nginx` to reload configurations
- **mkcert not installing**: Install manually from https://github.com/FiloSottile/mkcert or allow script to use self-signed certificates
