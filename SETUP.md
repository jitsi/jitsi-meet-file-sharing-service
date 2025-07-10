# Production Setup Guide

This guide helps you deploy the file sharing service to any domain/server by configuring environment variables.

## Step 1: Configure Environment Variables

Create a `.env` file with your specific settings:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

**Required Environment Variables:**

```bash
# Your domain and service path
BASE_URL=https://your-domain.com/file-service

# Path to your JWT public key file
JWT_PUBLIC_KEY_PATH=/path/to/your/jwt-public-key.pem

# Directory for uploaded files
UPLOAD_DIR=/var/www/jitsi-meet-file-sharing-service/uploads

# Server port (usually 3000)
PORT=3000

# Environment
NODE_ENV=production
```

## Step 2: Configure Nginx

1. **Update the Nginx configuration:**
```bash
# Edit the nginx.conf file
nano nginx.conf

# Replace YOUR_DOMAIN_HERE with your actual domain
sed -i 's/YOUR_DOMAIN_HERE/your-actual-domain.com/g' nginx.conf
```

2. **Deploy the Nginx config:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/jitsi-meet-file-sharing-service
sudo ln -s /etc/nginx/sites-available/jitsi-meet-file-sharing-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 3: Set Up JWT Public Key

1. **Convert your SSH public key to PEM format (if needed):**
```bash
ssh-keygen -f /path/to/your/ssh-key.pub -e -m pem > /path/to/jwt-public-key.pem
```

2. **Or copy your existing PEM key to the configured path:**
```bash
sudo cp your-jwt-key.pem /etc/ssl/certs/jwt-public-key.pem
sudo chmod 644 /etc/ssl/certs/jwt-public-key.pem
```

## Step 4: Deploy the Service

```bash
# Install dependencies and build
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

## Example Configurations

### For domain: `example.com`
```bash
BASE_URL=https://example.com/file-service
JWT_PUBLIC_KEY_PATH=/etc/ssl/certs/jwt-public-key.pem
UPLOAD_DIR=/var/www/jitsi-meet-file-sharing-service/uploads
```

### For domain: `meet.mycompany.com`
```bash
BASE_URL=https://meet.mycompany.com/file-service
JWT_PUBLIC_KEY_PATH=/home/ubuntu/keys/jwt-public.pem
UPLOAD_DIR=/home/ubuntu/jitsi-meet-file-sharing-service/uploads
```

## Verification

1. **Check service health:**
```bash
curl https://your-domain.com/file-service/health
```

2. **Check environment variables:**
```bash
pm2 show jitsi-meet-file-sharing-service
```

3. **Test file upload/download workflow:**
   - Upload a file with valid JWT token
   - Retrieve file metadata
   - Download the file using the presigned URL

## Troubleshooting

- **Wrong BASE_URL**: Download URLs will point to incorrect domain
- **Missing JWT key**: All requests will get 403 errors
- **Nginx misconfiguration**: CORS errors or 404s
- **Permissions**: Upload directory must be writable by the service user

The service is now completely configurable and can be deployed to any domain without hardcoded values.
