#!/bin/bash
set -e

# Configure opcache based on ENABLE_CACHING environment variable
if [ "$ENABLE_CACHING" = "false" ]; then
    echo "Disabling all caching (opcache, Redis sessions)"
    # Disable opcache
    echo "opcache.enable = 0" > /usr/local/etc/php/conf.d/zz-disable-cache.ini
    echo "opcache.enable_cli = 0" >> /usr/local/etc/php/conf.d/zz-disable-cache.ini

    # Disable Redis session handler (use files instead)
    echo "session.save_handler = files" >> /usr/local/etc/php/conf.d/zz-disable-cache.ini
    echo "session.save_path = /tmp" >> /usr/local/etc/php/conf.d/zz-disable-cache.ini

    echo "Cache disabled for troubleshooting"
else
    # Remove the disable-cache file if it exists
    rm -f /usr/local/etc/php/conf.d/zz-disable-cache.ini
    echo "Cache enabled (opcache, Redis sessions)"
fi

# Execute the original entrypoint
exec docker-entrypoint.sh "$@"
