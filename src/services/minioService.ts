import { Client } from 'minio';

interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

const MINIO_CONFIG: MinioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  bucket: process.env.MINIO_BUCKET || 'excalidraw',
};

export class MinioService {
  private client: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = MINIO_CONFIG.bucket;
    this.client = new Client({
      endPoint: MINIO_CONFIG.endPoint,
      port: MINIO_CONFIG.port,
      useSSL: MINIO_CONFIG.useSSL,
      accessKey: MINIO_CONFIG.accessKey,
      secretKey: MINIO_CONFIG.secretKey,
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
    console.log(`Saved file to MinIO: ${objectName}`);
  }

  async getFile(objectName: string): Promise<Buffer | null> {
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
      console.log(`Deleted file from MinIO: ${objectName}`);
      return true;
    } catch (error: any) {
      console.error(`Error deleting file from MinIO: ${objectName}`, error);
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