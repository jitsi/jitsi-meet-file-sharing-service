import { Request } from 'express';

export interface CssFileMetadataResponse {
  objectId: string;
  sessionId: string;
  timestamp: number;
  contentType: string;
  objectName: string;
  initiatorId: string;
  preSignedUrl: string;
}

export interface DocumentMetadataResponse {
  fileId: string;
  sessionId: string;
  fileName: string;
  customerId: string;
  userId: string;
  presignedUrl: string;
  createdAt: number;
  fileSize: number;
}

export interface AddDocumentResponse {
  fileId: string;
}

export interface PaginatedResponseCssFileMetadataResponse {
  content: CssFileMetadataResponse[];
  nextStartWith?: string;
}

export interface FileMetadata {
  conferenceFullName: string;
  timestamp: number;
  fileSize: number;
  fileId: string;
}

export interface JwtPayload {
  sub: string;
  backend_region: string;
  nbf?: number;
  aud: string | string[];
  exp?: number;
  room: string;
  meeting_id: string;
  iss: string;
  context: {
    user: {
      name: string;
      avatar?: string;
      id: number;
      moderator: boolean;
      'hidden-from-recorder'?: boolean;
      email?: string;
      role: string;
    };
    features: {
      'outbound-call'?: boolean;
      'sip-outbound-call'?: boolean;
      'file-upload'?: boolean;
      recording?: boolean;
      livestreaming?: boolean;
      transcription?: boolean;
    };
  };
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface FileRecord {
  fileId: string;
  sessionId: string;
  fileName: string;
  originalName: string;
  contentType: string;
  fileSize: number;
  userId: string;
  customerId: string;
  createdAt: number;
  filePath: string;
  metadata: FileMetadata;
}