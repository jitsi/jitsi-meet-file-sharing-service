import { Router, Request, Response } from 'express';
import { MinioService } from '../services/minioService';
import { upload } from '../utils/multer';
import { verifyFirebaseToken, skipAuthForDev, AuthRequest } from '../middleware/excalidrawAuth';

const router = Router();
const minioService = new MinioService();

const isDev = process.env.NODE_ENV === 'development';
const authMiddleware = isDev ? skipAuthForDev : verifyFirebaseToken;

interface SceneDocument {
  sceneVersion: number;
  ciphertext: string; // base64 encoded
  iv: string; // base64 encoded
}

// Save scene to MinIO
router.post('/scenes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    console.log('Saving scene for user:', user?.email || user?.user_id);
    
    const { roomId, sceneVersion, ciphertext, iv }: any = req.body;

    if (!roomId || !sceneVersion || !ciphertext || !iv) {
      return res.status(400).json({ 
        error: 'Missing required fields: roomId, sceneVersion, ciphertext, iv' 
      });
    }

    const sceneDocument: SceneDocument = {
      sceneVersion,
      ciphertext,
      iv,
    };

    const objectName = `scenes/${roomId}.json`;
    const buffer = Buffer.from(JSON.stringify(sceneDocument), 'utf-8');
    
    await minioService.saveFile(objectName, buffer, 'application/json');

    // console.log(`Saved scene: ${roomId}`);
    res.json({ success: true, roomId, sceneVersion });
  } catch (error: any) {
    console.error('Error saving scene:', error);
    res.status(500).json({ error: 'Failed to save scene', details: error.message });
  }
});

// Load scene from MinIO
router.get('/scenes/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const objectName = `scenes/${roomId}.json`;
    const buffer = await minioService.getFile(objectName);

    if (!buffer) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const sceneDocument: SceneDocument = JSON.parse(buffer.toString('utf-8'));

    res.json(sceneDocument);
  } catch (error: any) {
    console.error('Error loading scene:', error);
    res.status(500).json({ error: 'Failed to load scene', details: error.message });
  }
});

// Saving multiple files to MinIO using Multer
router.post('/files/upload', authMiddleware, upload.array('files'), async (req: AuthRequest, res: Response) => {
  try {    
    const { prefix } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!prefix) {
      console.log('No prefix provided');
      return res.status(400).json({ error: 'Prefix is required' });
    }

    if (!files || files.length === 0) {
      console.log('No files uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const savedFiles: string[] = [];
    const erroredFiles: string[] = [];

    await Promise.all(
      files.map(async (file) => {
        try {
          const fileId = file.originalname || file.fieldname;
          const objectName = `${prefix}/${fileId}`;
          await minioService.saveFile(objectName, file.buffer, file.mimetype);
          savedFiles.push(fileId);
          console.log(`Successfully uploaded file: ${fileId}`);
        } catch (error: any) {
          console.error(`Error saving file ${file.originalname}:`, error);
          erroredFiles.push(file.originalname || file.fieldname);
        }
      })
    );

    res.json({ savedFiles, erroredFiles });
  } catch (error: any) {
    console.error('Error saving files:', error);
    res.status(500).json({ error: 'Failed to save files', details: error.message });
  }
});


// Load file from MinIO
router.get('/files/download/*', async (req: Request, res: Response) => {
  try {
    const fullPath = req.params[0];
    
    if (!fullPath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const buffer = await minioService.getFile(fullPath);
    
    if (!buffer) {
      console.log('File not found in MinIO:', fullPath);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log('Successfully sending file:', fullPath, 'Size:', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file', details: error.message });
  }
});

// To check if scene exists
router.head('/scenes/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const objectName = `scenes/${roomId}.json`;
    
    const exists = await minioService.fileExists(objectName);
    
    if (exists) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  } catch (error: any) {
    console.error('Error checking scene existence:', error);
    res.status(500).end();
  }
});

export default router;