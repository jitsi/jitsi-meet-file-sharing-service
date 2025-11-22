import { Client } from 'minio';
import { StorageConfig } from '../types';

const S3_STORAGE_CONFIG: StorageConfig = {
  endpoint: process.env.S3_STORAGE_ENDPOINT || 'localhost',
  port: parseInt(process.env.S3_STORAGE_PORT || '9000', 10),
  useSSL: process.env.S3_STORAGE_USE_SSL === 'true',
  accessKey: process.env.S3_STORAGE_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_STORAGE_SECRET_KEY || 'minioadmin',
  bucket: process.env.S3_STORAGE_BUCKET || 'jitsi',
};

export class S3StorageService {
  private client: Client;
  private readonly bucket: string;

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

  async saveFile(objectName: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    await this.ensureBucket();
    
    const metadata = {
      'Content-Type': contentType
    };

    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, metadata);
    console.log(`Saved file to S3 Storage: ${objectName}`);
  }

  async getFileById(objectName: string): Promise<Buffer | null> {
    try {
      await this.ensureBucket();
      const stream = await this.client.getObject(this.bucket, objectName);
      
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error: any) {
      if (error.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async deleteFile(objectName: string): Promise<boolean> {
    try {
      await this.ensureBucket();
      await this.client.removeObject(this.bucket, objectName);
      console.log(`Deleted file from S3 Storage: ${objectName}`);
      return true;
    } catch (error: any) {
      console.error(`Error deleting file from S3 Storage: ${objectName}`, error);
      return false;
    }
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch (error: any) {
      return false;
    }
  }
}