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
