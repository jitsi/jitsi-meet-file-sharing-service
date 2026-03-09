import { Response, Router } from 'express';

import { authenticateToken, requireFileUploadFeature } from '../middleware/auth';
import { FileStorageService } from '../services/fileStorage';
import {
    IAddDocumentResponse,
    ICssFileMetadataResponse,
    IDocumentMetadataResponse,
    IFileMetadata
} from '../types';
import { upload } from '../utils/multer';
import { validatePresignedUrl } from '../utils/presignedUrl';

const router = Router();
const fileStorage = new FileStorageService();

function validateSessionAccess(req: any, sessionId: string, res: Response): boolean {
    if (req.user.meeting_id !== sessionId) {
        res.status(403).json({ error: 'Access denied: token not valid for this session' });

        return false;
    }

    return true;
}

router.get('/sessions/:sessionId/files', authenticateToken, async (req: any, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!validateSessionAccess(req, sessionId, res)) return;

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

        if (!validateSessionAccess(req, sessionId, res)) return;

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
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/sessions/:sessionId/files', authenticateToken, requireFileUploadFeature, async (req: any, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!validateSessionAccess(req, sessionId, res)) return;

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
        const { sessionId, fileId } = req.params;

        if (!validateSessionAccess(req, sessionId, res)) return;

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
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/sessions/:sessionId/files/:fileId', authenticateToken, requireFileUploadFeature, async (req: any, res: Response) => {
    try {
        const { sessionId, fileId } = req.params;

        if (!validateSessionAccess(req, sessionId, res)) return;

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

router.get('/download/:fileId', async (req: any, res: Response) => {
    try {
        const { fileId } = req.params;
        const { expires, sig } = req.query as { expires?: string; sig?: string };

        if (!validatePresignedUrl(fileId, expires, sig)) {
            res.status(403).json({ error: 'Invalid or expired download link' });

            return;
        }

        const fileStream = await fileStorage.getFileStream(fileId);

        if (!fileStream) {
            res.status(404).json({ error: 'File not found' });

            return;
        }

        res.setHeader('Content-Type', fileStream.contentType);
        // Use RFC 5987 encoding to prevent HTTP header injection via attacker-controlled filenames.
        const encodedFileName = encodeURIComponent(fileStream.fileName).replace(/'/g, '%27');

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);

        fileStream.stream.on('error', (streamErr) => {
            console.error('Stream error while sending file:', fileId, streamErr);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        fileStream.stream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
