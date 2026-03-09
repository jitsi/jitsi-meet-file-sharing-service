import multer from 'multer';

const storage = multer.memoryStorage();

// Allowlist of accepted MIME types. Executable and script types are intentionally excluded.
export const ALLOWED_MIME_TYPES = new Set([
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'text/plain',
    'text/csv',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
]);

/**
 * Returns true if the buffer's magic bytes indicate a native executable
 * (ELF, PE/MZ, or Mach-O), regardless of the declared MIME type.
 */
export function isExecutableBuffer(buf: Buffer): boolean {
    if (buf.length < 4) return false;

    // ELF (Linux/Unix)
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;

    // PE / MZ (Windows)
    if (buf[0] === 0x4d && buf[1] === 0x5a) return true;

    // Mach-O (macOS) — all four byte-order variants
    if (buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa &&
            (buf[3] === 0xce || buf[3] === 0xcf)) return true;
    if (buf[0] === 0xce && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) return true;
    if (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) return true;

    return false;
}

export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(new Error(`File type not allowed: ${file.mimetype}`));

            return;
        }
        cb(null, true);
    }
});