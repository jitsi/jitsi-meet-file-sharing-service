# File Sharing Service

A TypeScript-based file sharing service with JWT authentication and local filesystem storage, built according to the OpenAPI specification.

## Features

- JWT-based authentication
- File upload with multipart/form-data
- Local filesystem storage
- Pre-signed URL generation
- Session-based file management
- RESTful API endpoints

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### Document Management
- `GET /v1/documents/sessions/{sessionId}/files` - List files in session
- `POST /v1/documents/sessions/{sessionId}/files` - Upload file
- `DELETE /v1/documents/sessions/{sessionId}/files` - Delete files by session/user/customer
- `GET /v1/documents/sessions/{sessionId}/files/{fileId}` - Get file metadata
- `DELETE /v1/documents/sessions/{sessionId}/files/{fileId}` - Delete specific file
- `GET /v1/documents/download/{fileId}` - Download file

### Health Check
- `GET /health` - Service health status

## Authentication

All document endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt-token>
```

The JWT token should contain `userId` and `customerId` claims for proper authorization.

## File Upload

Files are uploaded using multipart/form-data with two fields:
- `file`: The binary file data
- `metadata`: JSON string with file metadata

Example metadata:
```json
{
  "conferenceFullName": "room@conference.example.com",
  "timestamp": 1741017572040,
  "fileSize": 1042157,
  "fileId": "generated-uuid"
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `BASE_URL`: Base URL for pre-signed URLs (default: http://localhost:3000)
- `JWT_SECRET`: JWT signing secret (change in production)
- `UPLOAD_DIR`: Directory for uploaded files (default: ./uploads)