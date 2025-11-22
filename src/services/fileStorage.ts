import fs from 'fs/promises';
import _mime from 'mime-types';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { IFileMetadata, IFileRecord, IStorageService } from '../types';
import { S3StorageService } from './s3StorageService';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export class FileStorageService implements IStorageService {
    private fileRecords: Map<string, IFileRecord> = new Map();
    private s3Service: S3StorageService | null = null;
    private useS3: boolean;

    constructor() {
        this.useS3 = !!process.env.S3_STORAGE_ENDPOINT;
        if (this.useS3) {
            this.s3Service = new S3StorageService();
        }
    }

    private async ensureUploadDir(): Promise<void> {
        try {
            await fs.access(UPLOAD_DIR);
        } catch {
            await fs.mkdir(UPLOAD_DIR, { recursive: true });
        }
    }

    async saveFile(
            sessionId: string,
            file: Express.Multer.File,
            metadata: IFileMetadata,
            userId: string,
            customerId: string
    ): Promise<IFileRecord> {
        
        // Use fileId from metadata if provided, otherwise generate one
        const fileId = metadata.fileId || uuidv4();
        const fileExtension = path.extname(file.originalname);
        let filePath: string;
        let fileName: string;

        if (this.useS3 && this.s3Service) {
            // For S3, Using prefix if provided (whiteboard), else constructing path (normal files)
            if (metadata.prefix) {
                const cleanPrefix = metadata.prefix.startsWith('/') ? metadata.prefix.substring(1) : metadata.prefix;
                filePath = `${cleanPrefix}/${fileId}`;
            } else {
                filePath = `sessions/${sessionId}/${fileId}${fileExtension}`;
            }
            fileName = filePath;
            
            await this.s3Service.saveFile(filePath, file.buffer, file.mimetype);
            console.log(`File saved to S3 Storage: ${filePath}`);
        } else {
            // Local filesystem storage
            await this.ensureUploadDir();
            fileName = `${fileId}${fileExtension}`;
            filePath = path.join(UPLOAD_DIR, fileName);
            await fs.writeFile(filePath, file.buffer);
        }

        const fileRecord: IFileRecord = {
            fileId,
            sessionId,
            fileName,
            originalName: file.originalname,
            contentType: file.mimetype,
            fileSize: file.size,
            userId,
            customerId,
            createdAt: Date.now(),
            filePath,
            metadata
        };

        // Store by full path for whiteboard images, fileId for normal files
        const storageKey = metadata.prefix ? filePath : fileId;
        this.fileRecords.set(storageKey, fileRecord);
        console.log('File saved to storage:', fileId);
        console.log('Total files in storage:', this.fileRecords.size);

        return fileRecord;
    }

    async getFilesBySession(sessionId: string): Promise<IFileRecord[]> {
        return Array.from(this.fileRecords.values()).filter(
      record => record.sessionId === sessionId
        );
    }

    async getFileById(fileId: string): Promise<IFileRecord | undefined> {
        return this.fileRecords.get(fileId);
    }

    async deleteFile(fileId: string): Promise<boolean> {
        let fileRecord = this.fileRecords.get(fileId);
        let keyToDelete = fileId;

        if (!fileRecord) {
            // If record isn't found, then we search in filePath (for whiteboard images)
            for (const [key, record] of this.fileRecords.entries()) {
                if (record.filePath === fileId || key === fileId) {
                    fileRecord = record;
                    keyToDelete = key;
                    break;
                }
            }
        }

        if (!fileRecord) return false;

        try {
            if (this.useS3 && this.s3Service) {
                await this.s3Service.deleteFile(fileRecord.filePath);
            } else {
                await fs.unlink(fileRecord.filePath);
            }
            this.fileRecords.delete(keyToDelete);

            return true;
        } catch {
            return false;
        }
    }

    async deleteFilesBySession(sessionId: string, userId?: string, customerId?: string): Promise<number> {
        const filesToDelete = Array.from(this.fileRecords.values()).filter(record => {
            if (record.sessionId !== sessionId) return false;
            if (userId && record.userId !== userId) return false;
            if (customerId && record.customerId !== customerId) return false;

            return true;
        });

        let deletedCount = 0;

        for (const file of filesToDelete) {
            if (await this.deleteFile(file.fileId)) {
                deletedCount++;
            }
        }

        return deletedCount;
    }

    generatePreSignedUrl(fileId: string): string {
        return `${BASE_URL}/v1/documents/download/${fileId}`;
    }

    async getFileStream(fileId: string): Promise<{ contentType: string; fileName: string; stream: NodeJS.ReadableStream | Buffer; } | null> {
        const fileRecord = this.fileRecords.get(fileId);

        if (!fileRecord) return null;

        try {
            if (this.useS3 && this.s3Service) {
                const buffer = await this.s3Service.getFileById(fileRecord.filePath);
                if (!buffer) return null;
                
                return {
                    stream: buffer,
                    contentType: fileRecord.contentType,
                    fileName: fileRecord.originalName
                };
            } else {
                const stream = await fs.open(fileRecord.filePath, 'r');

                return {
                    stream: stream.createReadStream(),
                    contentType: fileRecord.contentType,
                    fileName: fileRecord.originalName
                };
            }
        } catch {
            return null;
        }
    }
}
