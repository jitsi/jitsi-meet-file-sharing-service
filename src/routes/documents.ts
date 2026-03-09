import { Response, Router } from 'express';

import { authenticateToken, requireFileUploadFeature } from '../middleware/auth';
import { FileStorageService } from '../services/fileStorage';
import {
    IAddDocumentResponse,
    ICssFileMetadataResponse,
    IDocumentMetadataResponse,
    IFileMetadata
} from '../types';
import { isExecutableBuffer, upload } from '../utils/multer';
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

        const MAX_PAGE_SIZE = 100;
        const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query['page-size'] as string) || 20));

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
        console.error('GET /sessions/:sessionId/files error:', error);
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

        // Magic byte check runs here because file.buffer is only available after
        // multer has stored the upload in memory (cannot be done inside fileFilter).
        if (isExecutableBuffer(file.buffer)) {
            res.status(400).json({ error: 'File type not allowed' });

            return;
        }

        let metadata: IFileMetadata;

        try {
            metadata = JSON.parse(req.body.metadata);
        } catch {
            res.status(400).json({ error: 'Invalid metadata JSON' });

            return;
        }

        if (
            typeof metadata !== 'object' ||
            metadata === null ||
            typeof metadata.conferenceFullName !== 'string' ||
            typeof metadata.fileSize !== 'number' ||
            metadata.fileSize <= 0 ||
            typeof metadata.timestamp !== 'number'
        ) {
            res.status(400).json({ error: 'Invalid metadata: missing or malformed required fields' });

            return;
        }

        if (metadata.fileSize !== file.size) {
            res.status(400).json({ error: 'Invalid metadata: fileSize does not match uploaded file size' });

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
        console.error('POST /sessions/:sessionId/files error:', error);
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
        console.error('GET /sessions/:sessionId/files/:fileId error:', error);
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
        console.error('DELETE /sessions/:sessionId/files/:fileId error:', error);
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
        console.error('GET /download/:fileId error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
