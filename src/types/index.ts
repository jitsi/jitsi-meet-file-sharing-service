import { Request } from 'express';

export interface ICssFileMetadataResponse {
    contentType: string;
    initiatorId: string;
    objectId: string;
    objectName: string;
    preSignedUrl: string;
    sessionId: string;
    timestamp: number;
}

export interface IDocumentMetadataResponse {
    createdAt: number;
    customerId: string;
    fileId: string;
    fileName: string;
    fileSize: number;
    presignedUrl: string;
    sessionId: string;
    userId: string;
}

export interface IAddDocumentResponse {
    fileId: string;
}

export interface IPaginatedResponseCssFileMetadataResponse {
    content: ICssFileMetadataResponse[];
    nextStartWith?: string;
}

export interface IFileMetadata {
    conferenceFullName: string;
    fileId: string;
    fileSize: number;
    timestamp: number;
    prefix?: string;
}

export interface IJwtPayload {
    aud: string | string[];
    backend_region: string;
    context: {
        features: {
            'file-upload'?: boolean;
            livestreaming?: boolean;
            'outbound-call'?: boolean;
            recording?: boolean;
            'sip-outbound-call'?: boolean;
            transcription?: boolean;
        };
        user: {
            avatar?: string;
            email?: string;
            'hidden-from-recorder'?: boolean;
            id: number;
            moderator: boolean;
            name: string;
            role: string;
        };
    };
    exp?: number;
    iss: string;
    meeting_id: string;
    nbf?: number;
    room: string;
    sub: string;
}

export interface IAuthenticatedRequest extends Request {
    user: IJwtPayload;
}

export interface IFileRecord {
    contentType: string;
    createdAt: number;
    customerId: string;
    fileId: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    metadata: IFileMetadata;
    originalName: string;
    sessionId: string;
    userId: string;
}

export interface StorageConfig {
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface IStorageService {
  saveFile(sessionId: string, file: Express.Multer.File, metadata: IFileMetadata, userId: string, customerId: string): Promise<IFileRecord>;
  getFilesBySession(sessionId: string): Promise<IFileRecord[]>;
  getFileById(fileId: string): Promise<IFileRecord | undefined>;
  deleteFile(fileId: string): Promise<boolean>;
  deleteFilesBySession(sessionId: string, userId?: string, customerId?: string): Promise<number>;
  generatePreSignedUrl(fileId: string): string;
  getFileStream(fileId: string): Promise<{ contentType: string; fileName: string; stream: NodeJS.ReadableStream | Buffer; } | null>;
}