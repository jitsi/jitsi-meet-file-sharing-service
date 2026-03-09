import crypto from 'crypto';

const PRESIGNED_URL_SECRET = process.env.PRESIGNED_URL_SECRET;

if (!PRESIGNED_URL_SECRET) {
    throw new Error('PRESIGNED_URL_SECRET environment variable is required');
}

const DEFAULT_EXPIRY_SECONDS = 3600; // 1 hour

function generateSignature(fileId: string, expires: number): string {
    return crypto
        .createHmac('sha256', PRESIGNED_URL_SECRET!)
        .update(`${fileId}:${expires}`)
        .digest('hex');
}

export function generatePresignedUrl(baseUrl: string, fileId: string): string {
    const expires = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;
    const sig = generateSignature(fileId, expires);

    return `${baseUrl}/v1/documents/download/${fileId}?expires=${expires}&sig=${sig}`;
}

export function validatePresignedUrl(
        fileId: string,
        expires: string | undefined,
        sig: string | undefined
): boolean {
    if (!expires || !sig) return false;

    const expiresNum = parseInt(expires, 10);

    if (isNaN(expiresNum) || expiresNum < Math.floor(Date.now() / 1000)) return false;

    const expectedSig = generateSignature(fileId, expiresNum);

    try {
        const sigBuf = Buffer.from(sig, 'hex');
        const expectedBuf = Buffer.from(expectedSig, 'hex');

        if (sigBuf.length !== expectedBuf.length) return false;

        return crypto.timingSafeEqual(sigBuf, expectedBuf);
    } catch {
        return false;
    }
}