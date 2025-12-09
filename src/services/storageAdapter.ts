import { IStorageService, IFileMetadata, IFileRecord } from '../types';
import { FileStorageService } from './fileStorage';
import { S3StorageService } from './s3StorageService';

export class StorageServiceAdapter implements IStorageService {
    private service: IStorageService;

    constructor() {
        const useS3 = !!process.env.S3_STORAGE_ENDPOINT;
        this.service = useS3 ? new S3StorageService() : new FileStorageService();
        console.log(`Using storage backend: ${useS3 ? 'S3' : 'Local Storage'}`);
    }

    async saveFile(
        sessionId: string,
        file: Express.Multer.File,
        metadata: IFileMetadata,
        userId: string,
        customerId: string
    ): Promise<IFileRecord> {
        return this.service.saveFile(sessionId, file, metadata, userId, customerId);
    }

    async getFilesBySession(sessionId: string): Promise<IFileRecord[]> {
        return this.service.getFilesBySession(sessionId);
    }

    async getFileById(fileId: string): Promise<IFileRecord | undefined> {
        return this.service.getFileById(fileId);
    }

    async deleteFile(fileId: string): Promise<boolean> {
        return this.service.deleteFile(fileId);
    }

    async deleteFilesBySession(sessionId: string, userId?: string, customerId?: string): Promise<number> {
        return this.service.deleteFilesBySession(sessionId, userId, customerId);
    }

    generatePreSignedUrl(fileId: string): string {
        return this.service.generatePreSignedUrl(fileId);
    }

    async getFileStream(fileId: string): Promise<{ contentType: string; fileName: string; stream: NodeJS.ReadableStream | Buffer; } | null> {
        return this.service.getFileStream(fileId);
    }
}
