# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a file sharing service API specification repository containing only an OpenAPI 3.0.1 specification file (`file-sharing.yaml`). The repository defines a REST API for managing file sharing features in meeting/conference contexts.

## API Architecture

The API is designed around session-based file sharing with the following key concepts:

- **Sessions**: Meeting or conference sessions identified by `sessionId`
- **Files**: Documents shared within sessions, identified by `fileId`
- **Pre-signed URLs**: Temporary URLs for file access with expiration times
- **Metadata**: Rich file information including timestamps, content types, and user context

### Core Endpoints

- `GET /v1/documents/sessions/{sessionId}/files` - Retrieve file metadata with pre-signed URLs
- `POST /v1/documents/sessions/{sessionId}/files` - Upload documents with metadata
- `DELETE /v1/documents/sessions/{sessionId}/files` - Delete documents by session/user/customer
- `GET /v1/documents/sessions/{sessionId}/files/{fileId}` - Get individual file info
- `DELETE /v1/documents/sessions/{sessionId}/files/{fileId}` - Delete specific file

### Authentication

Uses HTTP Bearer token authentication (`HttpBearerKey` security scheme).

### Data Models

Key response models include:
- `CssFileMetadataResponse`: File listing with pre-signed URLs
- `DocumentMetadataResponse`: Individual file metadata
- `AddDocumentResponse`: File upload confirmation

## Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Project Structure

```
src/
├── index.ts           # Main application entry point
├── types/            # TypeScript type definitions
├── middleware/       # Express middleware (auth)
├── services/         # Business logic (file storage)
├── routes/          # API route handlers
└── utils/           # Utility functions (multer config)
```

## Implementation Details

The service implements a complete file sharing API with:

- **Express.js** server with TypeScript
- **JWT authentication** for all document endpoints
- **Local filesystem storage** with in-memory file registry
- **Multer** for multipart/form-data file uploads
- **Pre-signed URLs** for file downloads
- **Session-based** file organization

### Key Files

- `src/services/fileStorage.ts` - Core file storage logic
- `src/middleware/auth.ts` - JWT authentication
- `src/routes/documents.ts` - All API endpoints
- `src/types/index.ts` - TypeScript interfaces matching OpenAPI schemas

### Authentication Flow

1. Obtain JWT token externally (containing `userId` and `customerId` claims)
2. Include token in `Authorization: Bearer <token>` header for all document endpoints

The service stores files locally and provides temporary download URLs. File metadata is kept in memory (consider persistent storage for production).