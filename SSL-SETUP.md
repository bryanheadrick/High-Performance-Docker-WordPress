# SSL Certificate Setup Guide

This guide helps you get trusted SSL certificates working in your browser without security warnings.

## The Problem

When you see `ERR_CERT_AUTHORITY_INVALID` or `NET::ERR_CERT_AUTHORITY_INVALID`, it means your browser doesn't trust the Certificate Authority (CA) that signed the SSL certificate.

## The Solution: mkcert

mkcert is a tool that creates locally-trusted SSL certificates by installing a local CA in your system's trust store.

## Installation & Setup

### Check if mkcert CA is Installed

First, check if mkcert's CA is already installed:

```bash
mkcert -CAROOT
```

This shows where the CA files are stored. If you see a path, mkcert is installed but the CA might not be trusted yet.

### Install the CA

Run this command to install the mkcert CA in your system's trust store:

```bash
mkcert -install
```

**What this does:**
- Creates a local Certificate Authority (CA)
- Installs it in your system's trust store
- Installs it in Firefox's trust store (if Firefox is installed)
- Makes all certificates signed by this CA automatically trusted

### Expected Output

```
The local CA is now installed in the system trust store! ⚡️
The local CA is now installed in Firefox's trust store (requires browser restart)! 🦊
```

## Platform-Specific Instructions

### Linux

1. **Install mkcert** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt install libnss3-tools

   # Then install mkcert
   curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
   chmod +x mkcert-v*-linux-amd64
   sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
   ```

2. **Install the CA**:
   ```bash
   mkcert -install
   ```

3. **For Chrome/Chromium**:
   - The CA is installed in the NSS database
   - Restart Chrome/Chromium
   - Certificates should now be trusted

4. **For Firefox**:
   - mkcert automatically installs in Firefox's certificate store
   - Restart Firefox
   - Certificates should now be trusted

### macOS

1. **Install mkcert** (if not already installed):
   ```bash
   brew install mkcert
   ```

2. **Install the CA**:
   ```bash
   mkcert -install
   ```

   You'll be prompted for your password to install the CA in the system keychain.

3. **Restart your browser**

### Windows

1. **Install mkcert**:
   ```powershell
   # Using Chocolatey
   choco install mkcert

   # OR using Scoop
   scoop bucket add extras
   scoop install mkcert
   ```

2. **Install the CA** (Run PowerShell as Administrator):
   ```powershell
   mkcert -install
   ```

3. **Restart your browser**

## Verifying Installation

### Check CA Installation

```bash
# Show where the CA is stored
mkcert -CAROOT

# Should output something like:
# /home/username/.local/share/mkcert
```

### Test in Browser

1. Create a test site:
   ```bash
   ./new-site.sh
   ```

2. Open the site in your browser: `https://yoursite.local`

3. Check the certificate:
   - Click the padlock icon in the address bar
   - Certificate should show as valid
   - Issued by: "mkcert [your username]"
   - No security warnings

### Expected Result

✅ **Green padlock** - Certificate is trusted
✅ **No warnings** - No "Not Secure" or "Your connection is not private"
✅ **Valid certificate** - Shows "Connection is secure"

## Troubleshooting

### Still Seeing Certificate Errors After Installing CA

**1. Restart Your Browser**

The browser needs to reload its certificate trust store:
- Close **all** browser windows
- Completely quit the browser
- Reopen and try again

**2. Clear Browser Certificate Cache**

**Chrome/Edge:**
```
Settings → Privacy and Security → Security → Manage Certificates → Clear SSL state
```

Or visit: `chrome://restart`

**Firefox:**
```
Settings → Privacy & Security → Certificates → View Certificates → Servers → Delete certificate
```

**3. Verify CA is Actually Installed**

```bash
# Check if CA root exists
ls -la $(mkcert -CAROOT)

# Should show:
# rootCA-key.pem
# rootCA.pem
```

**4. Reinstall the CA**

```bash
# Uninstall first
mkcert -uninstall

# Then reinstall
mkcert -install

# Restart browser
```

**5. Check Certificate Was Created for Correct Domain**

```bash
# List certificates in SSL directory
ls -la config/nginx/ssl/

# Each site should have:
# yoursite.local.crt
# yoursite.local.key
```

**6. Verify Nginx is Using Correct Certificate**

```bash
# Check Nginx config
cat config/nginx/conf.d/yoursite.local.conf | grep ssl_certificate

# Should show:
# ssl_certificate /etc/nginx/ssl/yoursite.local.crt;
# ssl_certificate_key /etc/nginx/ssl/yoursite.local.key;
```

### Browser-Specific Issues

#### Chrome/Chromium (Linux)

If Chrome doesn't trust the certificates:

```bash
# Ensure NSS tools are installed
sudo apt install libnss3-tools

# Reinstall CA
mkcert -install

# Restart Chrome
```

#### Firefox

Firefox uses its own certificate store:

```bash
# Check if Firefox profile was detected
mkcert -install

# If Firefox wasn't detected, manually import:
# 1. Open Firefox
# 2. Settings → Privacy & Security → Certificates → View Certificates
# 3. Authorities tab → Import
# 4. Navigate to: $(mkcert -CAROOT)/rootCA.pem
# 5. Check "Trust this CA to identify websites"
# 6. OK
```

#### Brave Browser

Brave might need additional steps:

```bash
# Install CA
mkcert -install

# Then in Brave:
# Settings → Additional Settings → Privacy and Security → Security
# → Manage Certificates → Authorities → Import
# Import: $(mkcert -CAROOT)/rootCA.pem
```

### Certificate Not Found Errors

If Nginx can't find the certificate:

```bash
# Verify certificate exists
ls -la config/nginx/ssl/yoursite.local.crt

# If missing, recreate it:
mkcert -cert-file config/nginx/ssl/yoursite.local.crt \
       -key-file config/nginx/ssl/yoursite.local.key \
       yoursite.local "*.yoursite.local"

# Restart Nginx
docker compose restart nginx
```

### Hosts File Issues

If site doesn't load at all:

```bash
# Verify hosts entry exists
grep yoursite.local /etc/hosts

# Should show:
# 127.0.0.1    yoursite.local

# If missing, add it:
echo "127.0.0.1    yoursite.local" | sudo tee -a /etc/hosts
```

## Manual Certificate Installation (Without mkcert)

If you can't use mkcert or prefer manual installation:

### Export the CA Certificate

```bash
# Find the CA location
CA_ROOT=$(mkcert -CAROOT)

# The CA certificate is at:
echo "$CA_ROOT/rootCA.pem"
```

### Import to System (Linux)

```bash
# Copy CA to system trust store
sudo cp $(mkcert -CAROOT)/rootCA.pem /usr/local/share/ca-certificates/mkcert-root.crt

# Update CA certificates
sudo update-ca-certificates

# Restart browser
```

### Import to Browser (Manual)

**Chrome/Chromium:**
1. Settings → Privacy and Security → Security
2. Manage Certificates
3. Authorities tab
4. Import
5. Select: `$(mkcert -CAROOT)/rootCA.pem`
6. Check "Trust this certificate for identifying websites"
7. OK

**Firefox:**
1. Settings → Privacy & Security
2. Certificates → View Certificates
3. Authorities tab
4. Import
5. Select: `$(mkcert -CAROOT)/rootCA.pem`
6. Check "Trust this CA to identify websites"
7. OK

**Edge:**
1. Settings → Privacy, search, and services → Security
2. Manage certificates
3. Trusted Root Certification Authorities → Import
4. Select: `$(mkcert -CAROOT)/rootCA.pem`
5. Place in "Trusted Root Certification Authorities"
6. Finish

## Security Notes

### Is This Safe?

✅ **Yes, for local development**

- The CA private key never leaves your machine
- Only you control which certificates are signed
- Perfect for local development environments

⚠️ **Important:**
- Never share your CA private key (`rootCA-key.pem`)
- Never use in production
- Only for local development

### CA File Locations

The CA files are stored at:

```bash
# Linux/macOS
~/.local/share/mkcert/

# Windows
%LocalAppData%\mkcert
```

**Files:**
- `rootCA.pem` - The CA certificate (can be shared)
- `rootCA-key.pem` - The CA private key (NEVER share!)

### Uninstalling mkcert CA

To remove the CA from your system:

```bash
# Uninstall from system trust stores
mkcert -uninstall

# Optionally remove all certificates
rm -rf $(mkcert -CAROOT)
```

## Quick Reference

### Common Commands

```bash
# Install CA (first time setup)
mkcert -install

# Check CA location
mkcert -CAROOT

# Create certificate for a site
mkcert -cert-file config/nginx/ssl/site.local.crt \
       -key-file config/nginx/ssl/site.local.key \
       site.local "*.site.local"

# Uninstall CA
mkcert -uninstall
```

### Workflow for New Sites

When you run `./new-site.sh`, it automatically:
1. ✅ Checks if mkcert is installed (installs if needed)
2. ✅ Installs the CA if not already installed
3. ✅ Creates site-specific certificate
4. ✅ Configures Nginx to use the certificate

You only need to:
1. Restart your browser (first time only)
2. Visit your site: `https://yoursite.local`

## Getting Help

If you're still experiencing issues:

1. **Check mkcert installation**:
   ```bash
   mkcert -version
   ```

2. **Verify CA is installed**:
   ```bash
   mkcert -CAROOT
   ls -la $(mkcert -CAROOT)
   ```

3. **Check browser console** for specific errors

4. **Try incognito/private mode** to rule out cache issues

5. **Check this project's issues**: https://github.com/FiloSottile/mkcert/issues

## Resources

- [mkcert GitHub Repository](https://github.com/FiloSottile/mkcert)
- [How HTTPS and Certificates Work](https://howhttps.works/)
- [Chrome Certificate Errors Guide](https://support.google.com/chrome/answer/6098869)
