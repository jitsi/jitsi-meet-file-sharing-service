import { Client } from 'minio';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { StorageConfig, IStorageService, IFileMetadata, IFileRecord } from '../types';

const S3_STORAGE_CONFIG: StorageConfig = {
  endpoint: process.env.S3_STORAGE_ENDPOINT || 'localhost',
  port: parseInt(process.env.S3_STORAGE_PORT || '9000', 10),
  useSSL: process.env.S3_STORAGE_USE_SSL === 'true',
  accessKey: process.env.S3_STORAGE_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_STORAGE_SECRET_KEY || 'minioadmin',
  bucket: process.env.S3_STORAGE_BUCKET || 'jitsi',
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export class S3StorageService implements IStorageService {
  private client: Client;
  private readonly bucket: string;
  private fileRecords: Map<string, IFileRecord> = new Map();

  constructor() {
    this.bucket = S3_STORAGE_CONFIG.bucket;
    this.client = new Client({
      endPoint: S3_STORAGE_CONFIG.endpoint,
      port: S3_STORAGE_CONFIG.port,
      useSSL: S3_STORAGE_CONFIG.useSSL,
      accessKey: S3_STORAGE_CONFIG.accessKey,
      secretKey: S3_STORAGE_CONFIG.secretKey,
    });

    this.ensureBucket().catch(console.error);
  }

  private async ensureBucket(): Promise<void> {
    try {
      const bucketExists = await this.client.bucketExists(this.bucket);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucket);
      }
    } catch (error: any) {
      throw new Error(`Failed to ensure bucket '${this.bucket}' exists: ${error.message}`);
    }
  }

  async saveFile(
    sessionId: string,
    file: Express.Multer.File,
    metadata: IFileMetadata,
    userId: string,
    customerId: string
  ): Promise<IFileRecord> {
    await this.ensureBucket();

    const fileId = metadata.fileId || uuidv4();
    const fileExtension = path.extname(file.originalname);
    
    let objectPath: string;
    if (metadata.prefix) {
      const cleanPrefix = metadata.prefix.startsWith('/') ? metadata.prefix.substring(1) : metadata.prefix;
      objectPath = `${cleanPrefix}/${fileId}`;
    } else {
      objectPath = `sessions/${sessionId}/${fileId}${fileExtension}`;
    }

    const contentMetadata = {
      'Content-Type': file.mimetype
    };

    await this.client.putObject(this.bucket, objectPath, file.buffer, file.buffer.length, contentMetadata);
    console.log(`Saved file to S3 Storage: ${objectPath}`);

    const fileRecord: IFileRecord = {
      fileId,
      sessionId,
      fileName: objectPath,
      originalName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size,
      userId,
      customerId,
      createdAt: Date.now(),
      filePath: objectPath,
      metadata
    };

    const storageKey = metadata.prefix ? objectPath : fileId;
    this.fileRecords.set(storageKey, fileRecord);
    
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
      await this.ensureBucket();
      await this.client.removeObject(this.bucket, fileRecord.filePath);
      this.fileRecords.delete(keyToDelete);
      console.log(`Deleted file from S3 Storage: ${fileRecord.filePath}`);
      return true;
    } catch (error: any) {
      console.error(`Error deleting file from S3 Storage: ${fileRecord.filePath}`, error);
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

  async getFileStream(fileId: string): Promise<{ contentType: string; fileName: string; stream: Buffer; } | null> {
    const fileRecord = this.fileRecords.get(fileId);
    if (!fileRecord) return null;

    try {
      await this.ensureBucket();
      const stream = await this.client.getObject(this.bucket, fileRecord.filePath);
      
      const chunks: Buffer[] = [];
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      return {
        stream: buffer,
        contentType: fileRecord.contentType,
        fileName: fileRecord.originalName
      };
    } catch (error: any) {
      if (error.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }
}