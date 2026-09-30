# High-Performance WordPress Docker Development Environment

A powerful, optimized Docker Compose setup for WordPress local development with support for large database operations, file uploads, and built-in performance optimizations.

## Quick Start

```bash
# Initial setup
./setup.sh

# Create additional sites (with trusted SSL!)
./new-site.sh

# Manage sites
./manage-sites.sh list
```

## Features

- **Multi-Site Support**: Run multiple WordPress sites concurrently with isolated databases
- **Trusted SSL Certificates**: Automatic mkcert integration for browser-trusted certificates
- **High Performance Stack**: Nginx, PHP-FPM, MariaDB, Redis
- **Performance Optimizations**:
  - Fastcgi cache
  - Redis object cache
  - Proxy cache
  - Brotli/Gzip compression
  - Opcache
- **Large File Handling**: Pre-configured for large file uploads (up to 512MB)
- **Database Optimizations**: Optimized MariaDB configuration for WordPress
- **Email Testing**: MailHog integration for email capture and testing
- **Development Tools**: WP-CLI, Composer
- **Plugin Support**: Pre-configured for WooCommerce and Updraft Plus
- **Multiple PHP Versions**: Choose from PHP 7.4, 8.0, 8.1, 8.2, or 8.3

## Requirements

- Docker and Docker Compose
- For Windows: PowerShell
- For macOS/Linux: Terminal with Bash
- mkcert (optional, auto-installed for trusted SSL certificates)
- sudo access (for modifying /etc/hosts)

## Quick Setup

### Windows

1. Run PowerShell as Administrator
2. Navigate to the project directory
3. Run the setup script:
   ```powershell
   .\setup.ps1
   ```
4. Follow the prompts to configure your environment
5. (Optional) Create additional sites - Note: Multi-site scripts are bash-based, use WSL or Git Bash

### macOS/Linux

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
6. (Optional) Create additional sites:
   ```bash
   ./new-site.sh
   ```

## Manual Configuration

If you prefer to set up manually:

1. Copy `.env.template` to `.env` and adjust the settings
2. Create directories as needed (see setup scripts for structure)
3. Configure your Nginx site in `config/nginx/conf.d/`
4. Generate SSL certificates and place in `config/nginx/ssl/`
5. Add the domain to your hosts file
6. Start the containers: `docker compose up -d`

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

## Multi-Site Support

This environment supports running multiple WordPress sites concurrently within a single Docker setup. Each site has its own domain, database, and SSL certificate.

**Architecture**: All sites share the same Docker containers (Nginx, PHP-FPM, MariaDB, Redis). Each site is isolated with:
- Separate directory: `sites/{domain}/`
- Separate database within the shared MariaDB container
- Separate Nginx server block configuration
- Separate SSL certificate

### Creating Additional Sites

```bash
./new-site.sh
```

The script will:
- Install mkcert (if not already installed) for trusted SSL certificates
- Create a new site directory in `sites/{domain}/`
- Set up an isolated database
- Generate browser-trusted SSL certificates (no security warnings!)
- Configure Nginx
- Install WordPress via WP-CLI
- Update your hosts file

### Managing Sites

```bash
# List all sites
./manage-sites.sh list

# Show site details
./manage-sites.sh show mysite.local

# Remove a site
./manage-sites.sh remove mysite.local
```

### Working with Specific Sites

```bash
# WP-CLI commands for a specific site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local plugin list

# Access site-specific database
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} mysite_local
```

### SSL Certificates with mkcert

Sites created with `new-site.sh` automatically use [mkcert](https://github.com/FiloSottile/mkcert) to generate locally-trusted SSL certificates. This means:
- ✅ No browser security warnings
- ✅ Trusted by Chrome, Firefox, Safari, Edge
- ✅ Automatic installation and configuration
- ✅ Perfect for local development

If mkcert installation fails, the script automatically falls back to self-signed certificates.

**Seeing `ERR_CERT_AUTHORITY_INVALID`?** See [SSL-SETUP.md](SSL-SETUP.md) for detailed setup instructions.

**Why use multi-site instead of separate directories?**

| Multi-Site (This Setup) | Separate Directories |
|------------------------|---------------------|
| ✅ Single Docker setup | ❌ Multiple Docker setups |
| ✅ Shared resources (less RAM/CPU) | ❌ Resource duplication |
| ✅ Centralized management | ❌ Manage each separately |
| ✅ Quick site creation (`./new-site.sh`) | ❌ Copy entire directory structure |
| ✅ All sites share same PHP version | ⚠️ Independent PHP versions |

For detailed information about multi-site workflows, advanced configuration, and best practices, see [MULTI-SITE.md](MULTI-SITE.md).

## Site Manager: CLI, MCP Server & Web UI

In addition to the `new-site.sh` / `manage-sites.sh` scripts, this repo includes a `wpstack` CLI, an MCP server, and a local web UI, all backed by the same shared logic.

### Setup

```bash
npm install
npm run build
npm link --workspace=@wpstack/cli
```

This makes the `wpstack` command available globally.

### CLI

```bash
wpstack site list
wpstack site show mysite.local
wpstack site create --domain mysite.local
wpstack site remove mysite.local

wpstack stack status
wpstack stack start
wpstack stack stop
wpstack stack restart

wpstack wp plugin list
wpstack wp option get siteurl
wpstack wp shell
```

Run from inside `sites/<domain>/` and the domain argument can be omitted for `show` and `remove`.

`wpstack wp` runs wp-cli for whichever site directory you're currently in (detected the same way as `show`/`remove`), or the default WordPress install if run from the repo root. All arguments after `wp` are passed straight through to `wp-cli` inside the container.

### Web UI

```bash
wpstack ui
```

Opens a local web UI at `http://127.0.0.1:4321` for managing sites and the Docker stack from a browser. Binds to localhost only — not intended to be exposed beyond your machine.

### MCP Server

Register with an MCP-compatible AI client (e.g. Claude Desktop, Claude Code) by pointing it at the `wpstack mcp` command:

```json
{
  "mcpServers": {
    "wpstack": {
      "command": "wpstack",
      "args": ["mcp"]
    }
  }
}
```

This exposes `list_sites`, `get_site`, `create_site`, `remove_site`, `stack_status`, `stack_start`, `stack_stop`, and `stack_restart` as MCP tools.

## Switching PHP Versions

To switch PHP versions after setup:

1. Edit your `.env` file and change the `PHP_VERSION` value
2. Rebuild the WordPress container:
   ```bash
   docker compose up -d --build wordpress
   ```

## Development Tools

### Email Testing (MailHog)

All outbound emails are captured by MailHog:
- Web UI: `http://localhost:8025`
- No emails are sent to real addresses during development
- Test email sending via WP-CLI:
  ```bash
  docker compose exec wordpress wp --allow-root eval 'wp_mail("test@example.com", "Test", "Message");'
  ```

### WP-CLI & Composer

Both tools are pre-installed in the WordPress container:
```bash
# WP-CLI
docker compose exec wordpress wp --allow-root [command]

# Composer
docker compose exec wordpress composer [command]
```

## Troubleshooting

### Common Issues

- **Browser SSL Warnings**: Use `./new-site.sh` which installs mkcert for trusted certificates, or accept self-signed certificates in your browser
- **Site Not Accessible**: Check `/etc/hosts` has the domain entry and Nginx config exists in `config/nginx/conf.d/`
- **Permission Issues**: Check folder permissions, containers run as www-data (UID 33)
- **Database Connection Errors**: Verify MariaDB container is running and credentials match in `.env` or `wp-config.php`
- **Large File Upload Failures**: Check both PHP (`php.ini`) and Nginx timeouts
- **Email Testing**: All emails are captured by MailHog at `http://localhost:8025`

### Log Files

Logs are stored in the `logs/` directory:
- `logs/nginx/` - Web server logs
- `logs/php/` - PHP error logs
- `logs/mysql/` - Database logs

## License

This project is open-source and available under the MIT License.