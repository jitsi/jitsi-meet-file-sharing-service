#!/bin/bash

# Production deployment script
set -e

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Creating necessary directories..."
mkdir -p logs uploads

echo "Setting up environment..."
if [ ! -f .env ]; then
    cp .env.production .env
    echo "Created .env file from .env.production"
    echo "Please update .env with your actual values"
fi

echo "Starting application with PM2..."
if command -v pm2 &> /dev/null; then
    pm2 start ecosystem.config.js --env production
    pm2 save
    echo "Application started with PM2"
else
    echo "PM2 not installed. Installing PM2..."
    npm install -g pm2
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup
    echo "Application started with PM2"
fi

echo "Deployment completed!"
echo "Check status with: pm2 status"
echo "View logs with: pm2 logs jitsi-meet-file-sharing-service"
