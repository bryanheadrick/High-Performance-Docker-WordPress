wordpress-docker/
├── .env                           # Environment variables file
├── docker-compose.yml             # Main Docker Compose configuration
├── setup.ps1                      # PowerShell setup script
├── setup.sh                       # Bash setup script for macOS users
├── wordpress/                     # WordPress files (populated during setup)
├── logs/                          # Log directory
│   ├── nginx/
│   ├── php/
│   └── mysql/
├── config/
│   ├── nginx/
│   │   ├── nginx.conf             # Global Nginx configuration
│   │   ├── conf.d/                # Directory for site configurations
│   │   │   └── site.conf.template # Site configuration template
│   │   ├── ssl/                   # SSL certificates
│   │   ├── fastcgi_cache/         # FastCGI cache directory
│   │   └── proxy_cache/           # Proxy cache directory
│   ├── php/
│   │   ├── php.ini                # Custom PHP settings
│   │   └── www.conf               # PHP-FPM configuration
│   ├── mysql/
│   │   ├── my.cnf                 # MariaDB configuration
│   │   └── initdb.d/              # SQL scripts for initialization
│   ├── redis/
│   │   └── redis.conf             # Redis configuration
│   └── monit/
│       ├── monitrc                # Monit control file
│       └── conf.d/                # Monit service configurations
│           └── services.conf      # Monitoring configurations for services
└── uploads.ini                    # PHP upload settings