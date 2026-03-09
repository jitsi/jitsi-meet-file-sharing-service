import fs from 'fs/promises';
import _mime from 'mime-types';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { IFileMetadata, IFileRecord } from '../types';
import { generatePresignedUrl } from '../utils/presignedUrl';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export class FileStorageService {
    private fileRecords: Map<string, IFileRecord> = new Map();

    async ensureUploadDir(): Promise<void> {
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
        await this.ensureUploadDir();

        // Use fileId from metadata only if it is a valid UUID, otherwise generate one.
        // This prevents path traversal via a crafted fileId value.
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const fileId = (metadata.fileId && UUID_REGEX.test(metadata.fileId)) ? metadata.fileId : uuidv4();
        const fileExtension = path.extname(file.originalname);
        const fileName = `${fileId}${fileExtension}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        await fs.writeFile(filePath, file.buffer);

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

        this.fileRecords.set(fileId, fileRecord);
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
        const fileRecord = this.fileRecords.get(fileId);

        if (!fileRecord) return false;

        try {
            await fs.unlink(fileRecord.filePath);
        } catch (error) {
            // Log but do not abort: the in-memory record must still be removed to
            // keep metadata consistent with the filesystem. An orphaned disk file
            // is preferable to an orphaned record that blocks future uploads.
            console.error('Failed to unlink file from disk:', fileRecord.filePath, error);
        }

        this.fileRecords.delete(fileId);

        return true;
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
        return generatePresignedUrl(BASE_URL, fileId);
    }

    async getFileStream(fileId: string): Promise<{ contentType: string; fileName: string; stream: NodeJS.ReadableStream; } | null> {
        const fileRecord = this.fileRecords.get(fileId);

        if (!fileRecord) return null;

        try {
            const stream = await fs.open(fileRecord.filePath, 'r');

            return {
                stream: stream.createReadStream(),
                contentType: fileRecord.contentType,
                fileName: fileRecord.originalName
            };
        } catch {
            return null;
        }
    }
}
