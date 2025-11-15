import { Response, Router } from 'express';

import { authenticateToken, requireFileUploadFeature } from '../middleware/auth';
import { FileStorageService } from '../services/fileStorage';
import { S3StorageService } from '../services/s3StorageService';
import {
    IAddDocumentResponse,
    ICssFileMetadataResponse,
    IDocumentMetadataResponse,
    IFileMetadata
} from '../types';
import { upload } from '../utils/multer';

const router = Router();
const fileStorage = new FileStorageService();

// Env var to control storage backend
const USE_S3_STORAGE = process.env.USE_S3_STORAGE === 'true';
const s3StorageService = USE_S3_STORAGE ? new S3StorageService() : null;


// WILL ADD THE MIDDLEWARE LATER authenticateToken
router.get('/sessions/:sessionId/files', authenticateToken, async (req: any, res: Response) => {
    try {
        const { sessionId } = req.params;
        const offset = parseInt(req.query.offset as string) || 0;
        const pageSize = parseInt(req.query['page-size'] as string) || 20;

        const files = await fileStorage.getFilesBySession(sessionId);
        const paginatedFiles = files.slice(offset, offset + pageSize);

        const response: ICssFileMetadataResponse[] = paginatedFiles.map(file => ({
            objectId: file.fileId,
            sessionId: file.sessionId,
            timestamp: file.createdAt,
            contentType: file.contentType,
            objectName: file.fileName,
            initiatorId: file.userId,
            preSignedUrl: fileStorage.generatePreSignedUrl(file.fileId)
        }));

        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/sessions/:sessionId/files', authenticateToken, requireFileUploadFeature, upload.single('file'), async (req: any, res: Response) => {
    try {
        const { sessionId } = req.params;
        const { user } = req;
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'No file uploaded' });

            return;
        }

        let metadata: IFileMetadata;

        try {
            metadata = JSON.parse(req.body.metadata);
        } catch {
            res.status(400).json({ error: 'Invalid metadata JSON' });

            return;
        }

        // Save to S3 Storage directly if USE_S3_STORAGE is enabled
        if (USE_S3_STORAGE && s3StorageService) {
            const savedFiles: string[] = [];
            const erroredFiles: string[] = [];
            const objectName = `${metadata.prefix}/${metadata.fileId}`;
            try{
                await s3StorageService.saveFile(objectName, file.buffer, file.mimetype);
                savedFiles.push(metadata.fileId);
            }
            catch (error) {
                erroredFiles.push(metadata.fileId);
            }
            res.json({ savedFiles, erroredFiles });

        } else {
        const fileRecord = await fileStorage.saveFile(
            sessionId,
            file,
            metadata,
            user.context.user.id.toString(),
            user.sub
        );

        const response: IAddDocumentResponse = {
            fileId: fileRecord.fileId
        };

        res.json(response);
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/sessions/:sessionId/files', authenticateToken, requireFileUploadFeature, async (req: any, res: Response) => {
    try {
        const { sessionId } = req.params;
        const userId = req.query['user-id'] as string;
        const customerId = req.query['customer-id'] as string;

        if (!userId || !customerId) {
            res.status(400).json({ error: 'user-id and customer-id are required' });

            return;
        }

        await fileStorage.deleteFilesBySession(sessionId, userId, customerId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/sessions/:sessionId/files/:fileId', authenticateToken, async (req: any, res: Response) => {
    try {
        const { fileId } = req.params;

    if (USE_S3_STORAGE && s3StorageService) {
        // Decoding the fileId back to proper S3 Storage path
        // Decoded FileId is in form of prefix/fileId => /files/rooms/roomId/fileId
        const decodedFileId = decodeURIComponent(fileId);
        
        const buffer = await s3StorageService.getFile(decodedFileId);

        if (!buffer) {
            console.log('File not found in S3 Storage:', decodedFileId);
            res.status(404).json({ error: 'File not found' });
            return;
        }

        res.send(buffer);
    } else {
        console.log('Looking for file:', fileId);

        const fileRecord = await fileStorage.getFileById(fileId);

        if (!fileRecord) {
            console.log('File not found in storage:', fileId);
            res.status(404).json({ error: 'File not found' });

            return;
        }

        const response: IDocumentMetadataResponse = {
            fileId: fileRecord.fileId,
            sessionId: fileRecord.sessionId,
            fileName: fileRecord.originalName,
            customerId: fileRecord.customerId,
            userId: fileRecord.userId,
            presignedUrl: fileStorage.generatePreSignedUrl(fileRecord.fileId),
            createdAt: fileRecord.createdAt,
            fileSize: fileRecord.fileSize
        };

        res.json(response);
    }
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/sessions/:sessionId/files/:fileId', authenticateToken, requireFileUploadFeature, async (req: any, res: Response) => {
    try {
        const { fileId } = req.params;

        const deleted = await fileStorage.deleteFile(fileId);

        if (!deleted) {
            res.status(404).json({ error: 'File not found' });

            return;
        }

        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        const fileStream = await fileStorage.getFileStream(fileId);

        if (!fileStream) {
            res.status(404).json({ error: 'File not found' });

            return;
        }

        res.setHeader('Content-Type', fileStream.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileStream.fileName}"`);

        fileStream.stream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
