# Deployment Guide

## Prerequisites

- Node.js 18+ installed on your server
- SSH access to your server
- Domain name (optional, for production)

## Quick SSH Server Deployment

### Option 1: Direct Node.js Deployment

1. **SSH into your server:**
```bash
ssh user@your-server-ip
```

2. **Clone or upload the project:**
```bash
# Option A: Clone from Git
git clone <your-repo-url>
cd jitsi-meet-file-sharing-service

# Option B: Upload via SCP from local machine
scp -r /path/to/jitsi-meet-file-sharing-service user@your-server-ip:/var/www/
```

3. **Install dependencies and build:**
```bash
npm install
npm run build
```

4. **Set up environment:**
```bash
cp .env.production .env
nano .env  # Edit with your values
```

5. **Run the deployment script:**
```bash
./deploy.sh
```

### Option 2: Docker Deployment

1. **SSH into your server and ensure Docker is installed:**
```bash
ssh user@your-server-ip
docker --version
```

2. **Upload project and build Docker image:**
```bash
# Upload project files
scp -r /path/to/jitsi-meet-file-sharing-service user@your-server-ip:/var/www/

# Build Docker image
cd /var/www/jitsi-meet-file-sharing-service
docker build -t jitsi-meet-file-sharing-service .
```

3. **Run with Docker:**
```bash
docker run -d \
  --name jitsi-meet-file-sharing-service \
  -p 3000:3000 \
  -e JWT_SECRET=your-secure-secret \
  -e BASE_URL=https://your-domain.com \
  -v /var/www/uploads:/app/uploads \
  jitsi-meet-file-sharing-service
```

## Cloud Platform Deployment

### AWS EC2

1. **Launch EC2 instance** (Ubuntu 20.04 LTS recommended)
2. **Configure security group** to allow port 3000
3. **SSH and follow Option 1 or 2 above**

### DigitalOcean Droplet

1. **Create Droplet** (Ubuntu 20.04, minimum 1GB RAM)
2. **SSH into droplet**
3. **Follow Option 1 or 2 above**

### VPS (Linode, Vultr, etc.)

1. **Create VPS instance**
2. **SSH into server**
3. **Follow Option 1 or 2 above**

## Nginx Reverse Proxy (Recommended)

1. **Install Nginx:**
```bash
sudo apt update
sudo apt install nginx
```

2. **Create Nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/jitsi-meet-file-sharing-service
```

3. **Add configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

4. **Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/jitsi-meet-file-sharing-service /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Monitoring and Logs

- **PM2 status:** `pm2 status`
- **PM2 logs:** `pm2 logs jitsi-meet-file-sharing-service`
- **Application logs:** `tail -f logs/app.log`
- **System logs:** `journalctl -u nginx -f`

## Environment Variables

Key variables to set in `.env`:

```env
PORT=3000
BASE_URL=https://your-domain.com
JWT_SECRET=your-very-secure-secret-key
UPLOAD_DIR=/var/www/jitsi-meet-file-sharing-service/uploads
NODE_ENV=production
```

## Security Considerations

- Change default JWT secret
- Set up firewall (UFW)
- Regular security updates
- Use HTTPS in production
- Restrict file upload sizes
- Monitor disk usage for uploads

## Troubleshooting

- **Port already in use:** `sudo lsof -i :3000`
- **Permission issues:** Check file permissions and ownership
- **Memory issues:** Monitor with `htop` or `pm2 monit`
- **Disk space:** Check uploads directory size
