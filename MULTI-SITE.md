# Multi-Site WordPress Docker Environment - Advanced Guide

This guide covers advanced multi-site features, workflows, and best practices. For basic setup and usage, see [README.md](README.md).

## Table of Contents

- [Architecture Deep Dive](#architecture)
- [Advanced mkcert Usage](#ssl-certificates-with-mkcert)
- [Working with Multiple Sites](#working-with-multiple-sites)
- [Site Management Workflows](#site-management-workflows)
- [Resource Considerations](#resource-considerations)
- [Advanced Configuration](#advanced-configuration)
- [Backup and Migration](#backup-and-migration)
- [Best Practices](#best-practices)

## Architecture

### Directory Structure

```
.
├── sites/                          # Multi-site installations
│   ├── site1.local/               # First site
│   │   ├── wp-admin/
│   │   ├── wp-content/
│   │   ├── wp-includes/
│   │   └── wp-config.php
│   └── site2.local/               # Second site
│       └── ...
├── wordpress/                      # Default/legacy site (optional)
├── config/
│   ├── nginx/
│   │   ├── conf.d/
│   │   │   ├── site1.local.conf  # Per-site Nginx config
│   │   │   └── site2.local.conf
│   │   └── ssl/
│   │       ├── site1.local.crt   # Per-site SSL cert
│   │       ├── site1.local.key
│   │       ├── site2.local.crt
│   │       └── site2.local.key
│   ├── php/
│   ├── mysql/
│   └── redis/
└── logs/                          # Shared logs
```

### Service Sharing

All sites share these services:
- **Nginx**: Single Nginx instance with multiple server blocks
- **PHP-FPM**: Single PHP-FPM pool serves all sites
- **MariaDB**: Single database server with multiple databases
- **Redis**: Shared Redis instance for object caching
- **MailHog**: Email testing for all sites

### Site Isolation

Each site is isolated with:
- **Separate directory**: `sites/{domain}/`
- **Separate database**: Each site has its own database and user
- **Separate Nginx config**: Each site has its own server block
- **Separate SSL certificate**: Each site has its own certificate
- **Separate domain**: Each site accessible via its own `.local` domain

## SSL Certificates with mkcert

### What is mkcert?

[mkcert](https://github.com/FiloSottile/mkcert) is a tool for creating locally-trusted SSL certificates without configuration hassles. It automatically installs a local Certificate Authority (CA) in your system's trust store.

### Benefits

- No browser security warnings
- Certificates trusted by all major browsers
- Works with Chrome, Firefox, Safari, Edge
- No manual trust configuration needed
- Perfect for local development

### Installation

The `new-site.sh` script automatically installs mkcert on first run:

**Linux**:
```bash
# Automatic installation via new-site.sh
./new-site.sh

# Or manual installation
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
mkcert -install
```

**macOS**:
```bash
# Via Homebrew (recommended)
brew install mkcert
mkcert -install

# Or automatic via new-site.sh
./new-site.sh
```

**Windows**:
```powershell
# Via Chocolatey
choco install mkcert
mkcert -install

# Via Scoop
scoop bucket add extras
scoop install mkcert
mkcert -install
```

### Fallback to Self-Signed

If mkcert installation fails, the script automatically falls back to creating self-signed certificates. These will work but browsers will show security warnings.

## Working with Multiple Sites

### WP-CLI Commands

Execute WP-CLI commands for specific sites:

```bash
# Default site
docker compose exec wordpress wp --allow-root plugin list

# Specific site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local plugin list

# Install plugin on specific site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local plugin install redis-cache --activate

# Update WordPress on specific site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local core update
```

### Database Access

Each site has its own database:

```bash
# List all databases
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "SHOW DATABASES;"

# Access specific site's database
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD}
mysql> USE site1_local;
mysql> SHOW TABLES;
```

### Cache Management

```bash
# Clear FastCGI cache (affects all sites)
docker compose exec nginx rm -rf /var/run/nginx-cache/*

# Clear Redis cache (affects all sites)
docker compose exec redis redis-cli FLUSHALL

# Clear cache for specific site via WP-CLI
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/mysite.local cache flush
```

### Logs

All sites share the same log files:

```bash
# View Nginx access logs (all sites)
tail -f logs/nginx/access.log

# View Nginx error logs (all sites)
tail -f logs/nginx/error.log

# View PHP-FPM logs (all sites)
tail -f logs/php/error.log

# Filter logs for specific domain
grep "mysite.local" logs/nginx/access.log
```

## Site Management Workflows

### Creating a New Client Project

```bash
# Create new site
./new-site.sh
# Enter: clientname.local
# Enter database and admin details

# Install theme and plugins
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/clientname.local theme install mytheme --activate
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/clientname.local plugin install redis-cache --activate

# Import content
docker compose exec -T mariadb mysql -uclientname_local -p < client-data.sql
```

### Testing Different WordPress Versions

```bash
# Create sites with different WP versions
./new-site.sh  # wp-latest.local
./new-site.sh  # wp-previous.local

# Downgrade one site
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/wp-previous.local core update --version=6.4
```

### Testing Plugin Compatibility

```bash
# Create test sites
./new-site.sh  # plugin-test-php80.local
./new-site.sh  # plugin-test-php83.local

# Change PHP version and rebuild
# Edit .env: PHP_VERSION=8.0
docker compose up -d --build wordpress

# Test plugin on both sites
```

### Development and Staging Sites

```bash
# Create development site
./new-site.sh  # project-dev.local

# Copy to staging when ready
cp -r sites/project-dev.local sites/project-staging.local
./manage-sites.sh show project-dev.local  # Get DB credentials
# Manually create staging DB and import dev data
# Create new Nginx config for staging
```

## Resource Considerations

### Memory Usage

Each WordPress site shares the same PHP-FPM pool. Monitor memory:

```bash
# Check PHP-FPM memory usage
docker stats wpdev-wordpress

# Adjust PHP-FPM pool settings in config/php/www.conf if needed
```

### Disk Space

Each site includes a full WordPress installation. Monitor disk usage:

```bash
# Check size of all sites
du -sh sites/*

# Check database sizes
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "
SELECT table_schema AS 'Database',
       ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
GROUP BY table_schema;"
```

### Performance Tips

1. **Limit active sites**: Keep only needed sites running
2. **Use Redis cache**: Install redis-cache plugin on each site
3. **Enable FastCGI cache**: Already configured in Nginx
4. **Clean up unused sites**: Use `./manage-sites.sh remove` regularly
5. **Monitor resources**: Use `docker stats` to check resource usage

## Troubleshooting

### Site Not Accessible

```bash
# Check if domain is in hosts file
grep mysite.local /etc/hosts

# Check if Nginx config exists
ls -la config/nginx/conf.d/mysite.local.conf

# Reload Nginx
docker compose restart nginx

# Check Nginx logs
docker compose logs nginx
```

### SSL Certificate Errors

```bash
# Verify certificate files exist
ls -la config/nginx/ssl/mysite.local.*

# Check if mkcert CA is installed
mkcert -CAROOT

# Reinstall CA if needed
mkcert -install

# Regenerate certificate
cd config/nginx/ssl
mkcert -cert-file mysite.local.crt -key-file mysite.local.key mysite.local "*.mysite.local"
```

### Database Connection Issues

```bash
# Check if database exists
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "SHOW DATABASES;"

# Check database credentials in wp-config.php
cat sites/mysite.local/wp-config.php | grep DB_

# Test connection
docker compose exec mariadb mysql -u{DB_USER} -p{DB_PASS} {DB_NAME}
```

### Site Shows Wrong Content

This usually means Nginx is serving the wrong site:

```bash
# Check server_name in Nginx config
grep server_name config/nginx/conf.d/mysite.local.conf

# Verify domain in hosts file matches exactly
grep mysite.local /etc/hosts

# Clear browser cache and try incognito mode
```

## Advanced Configuration

### Custom PHP Settings Per Site

While PHP settings are shared, you can use `.user.ini` files:

```bash
# Create .user.ini in site root
cat > sites/mysite.local/.user.ini << EOF
upload_max_filesize = 128M
post_max_size = 128M
memory_limit = 512M
EOF

# Wait 5 minutes for PHP to reload .user.ini files
```

### Custom Nginx Configuration

Edit site-specific Nginx config:

```bash
# Edit config
nano config/nginx/conf.d/mysite.local.conf

# Test configuration
docker compose exec nginx nginx -t

# Reload Nginx
docker compose exec nginx nginx -s reload
```

### Separate Redis Database Per Site

Add to site's wp-config.php:

```php
define('WP_REDIS_DATABASE', 1); // Use DB 1 instead of default DB 0
```

Sites can use databases 0-15 (Redis default configuration).

## Backup and Migration

### Backup a Site

```bash
# Backup files
tar -czf backups/mysite-$(date +%Y%m%d).tar.gz sites/mysite.local/

# Backup database
docker compose exec mariadb mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} mysite_local > backups/mysite-$(date +%Y%m%d).sql
```

### Restore a Site

```bash
# Restore files
tar -xzf backups/mysite-20240101.tar.gz -C sites/

# Restore database (create DB first if needed)
docker compose exec -T mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} mysite_local < backups/mysite-20240101.sql
```

### Clone a Site

```bash
# Copy files
cp -r sites/original.local sites/clone.local

# Export database
docker compose exec mariadb mysqldump -uroot -p${MYSQL_ROOT_PASSWORD} original_local > /tmp/clone.sql

# Create new database
docker compose exec mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} -e "CREATE DATABASE clone_local;"

# Import database
docker compose exec -T mariadb mysql -uroot -p${MYSQL_ROOT_PASSWORD} clone_local < /tmp/clone.sql

# Update wp-config.php with new database details
nano sites/clone.local/wp-config.php

# Update site URL in database
docker compose exec wordpress wp --allow-root --path=/var/www/html/sites/clone.local search-replace 'https://original.local' 'https://clone.local'
```

## Best Practices

1. **Use descriptive domain names**: Use project names, not generic names
2. **Document site purpose**: Keep notes about what each site is for
3. **Regular cleanup**: Remove unused sites monthly
4. **Backup before changes**: Always backup before major changes
5. **Use version control**: Add sites/* to .gitignore, track only your custom code
6. **Monitor performance**: Watch resource usage with multiple sites
7. **Isolate databases**: Never share databases between sites
8. **Use mkcert**: Always use trusted certificates for better development experience
9. **Keep sites updated**: Regularly update WordPress core and plugins
10. **Test before removing**: Verify backups before removing sites

## Resources

- [mkcert GitHub Repository](https://github.com/FiloSottile/mkcert)
- [WP-CLI Documentation](https://wp-cli.org/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Server Block Examples](https://www.nginx.com/resources/wiki/start/topics/examples/server_blocks/)
