const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

const MIME_EXTENSIONS = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/gif', '.gif'],
    ['image/webp', '.webp'],
    ['application/pdf', '.pdf'],
    ['video/mp4', '.mp4'],
    ['video/webm', '.webm'],
    ['video/quicktime', '.mov'],
    ['video/x-msvideo', '.avi']
]);
const MIME_ALLOWED_EXTENSIONS = new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['image/gif', new Set(['.gif'])],
    ['image/webp', new Set(['.webp'])],
    ['application/pdf', new Set(['.pdf'])],
    ['video/mp4', new Set(['.mp4'])],
    ['video/webm', new Set(['.webm'])],
    ['video/quicktime', new Set(['.mov'])],
    ['video/x-msvideo', new Set(['.avi'])]
]);
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const DOCUMENT_MIMES = new Set([...IMAGE_MIMES, 'application/pdf']);
const TRAINING_MIMES = new Set(['application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);
const TRAINING_COVER_FIELD = 'cover_image_file';
const TRAINING_BADGE_FIELD = 'badge_image_file';
const TRAINING_LESSON_FIELD = /^lesson_\d+_file$/;
const TRAINING_COVER_MAX_SIZE = 10 * 1024 * 1024;

const matchesAllowedType = (file, allowedMimes) => {
    const allowedExtensions = MIME_ALLOWED_EXTENSIONS.get(file.mimetype);
    return Boolean(
        allowedExtensions
        && allowedMimes.has(file.mimetype)
        && allowedExtensions.has(path.extname(file.originalname || '').toLowerCase())
    );
};

// ── Cloudinary yapılandırması ──────────────────────────────────
// .env dosyasında şu değişkenler tanımlı olmalı:
// CLOUDINARY_CLOUD_NAME=xxx
// CLOUDINARY_API_KEY=xxx
// CLOUDINARY_API_SECRET=xxx

const useCloudinary = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('☁️  Cloudinary yapılandırması aktif.');
} else {
    console.log('💾 Cloudinary ayarlı değil, lokal disk kullanılıyor.');
}

// ── Lokal dizinleri oluştur (Cloudinary yoksa kullanılır) ───────
const dirs = ['videos', 'documents', 'avatars', 'feedback', 'feedback-comments', 'news', 'announcements'];
dirs.forEach(dir => {
    const p = path.join(__dirname, '..', 'uploads', dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Storage factory (lokal disk) ──────────────────────────────
const makeStorage = (subdir) => multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', 'uploads', subdir)),
    filename: (_req, file, cb) => {
        const suffix = `${Date.now()}-${require('node:crypto').randomUUID()}`;
        cb(null, `${subdir}-${suffix}${MIME_EXTENSIONS.get(file.mimetype) || '.bin'}`);
    }
});

// ── Cloudinary'e stream ile yükle ─────────────────────────────
/**
 * Multer memory buffer'ını Cloudinary'e yükler.
 * @param {Buffer} buffer - Dosya içeriği
 * @param {string} folder - Cloudinary klasörü (örn: 'avatars')
 * @param {object} options - Ek Cloudinary seçenekleri
 * @returns {Promise<{url: string, public_id: string}>}
 */
async function uploadToCloudinary(buffer, folder, options = {}) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: `calisanportal/${folder}`, ...options },
            (error, result) => {
                if (error) return reject(error);
                resolve({ url: result.secure_url, public_id: result.public_id });
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });
}

/**
 * Cloudinary'den bir dosyayı siler (public_id ile).
 * @param {string} public_id
 */
async function deleteFromCloudinary(public_id, options = {}) {
    try {
        if (public_id) await cloudinary.uploader.destroy(public_id, options);
    } catch (err) {
        console.error('Cloudinary silme hatası:', err.message);
    }
}

async function deleteFromCloudinaryStrict(public_id, options = {}) {
    if (public_id) await cloudinary.uploader.destroy(public_id, options);
}

// ── Avatar upload ──────────────────────────────────────────────
// Cloudinary varsa memory storage, yoksa disk storage kullanır.
const avatarUpload = multer({
    storage: useCloudinary ? multer.memoryStorage() : makeStorage('avatars'),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!matchesAllowedType(file, IMAGE_MIMES))
            return cb(new Error('Sadece resim dosyalari kabul edilir'));
        cb(null, true);
    }
});

// ── News upload ────────────────────────────────────────────────
const newsUpload = multer({
    storage: useCloudinary ? multer.memoryStorage() : makeStorage('news'),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!matchesAllowedType(file, IMAGE_MIMES))
            return cb(new Error('Sadece resim dosyalari kabul edilir'));
        cb(null, true);
    }
});

// ── Document upload ────────────────────────────────────────────
const announcementUpload = multer({
    storage: useCloudinary ? multer.memoryStorage() : makeStorage('announcements'),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!matchesAllowedType(file, DOCUMENT_MIMES)) {
            return cb(new Error('Sadece PDF veya resim dosyalari kabul edilir'));
        }
        cb(null, true);
    }
});

const docUpload = multer({
    storage: useCloudinary ? multer.memoryStorage() : makeStorage('documents'),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!matchesAllowedType(file, DOCUMENT_MIMES)) {
            return cb(new Error('Sadece PDF veya resim dosyalari kabul edilir'));
        }
        cb(null, true);
    }
});

// ── Feedback upload ────────────────────────────────────────────
const feedbackFileFilter = (_req, file, cb) => {
    if (!matchesAllowedType(file, DOCUMENT_MIMES)) {
        return cb(new Error('Sadece PDF veya resim dosyalari kabul edilir'));
    }
    cb(null, true);
};
const feedbackUpload = multer({
    storage: useCloudinary ? multer.memoryStorage() : makeStorage('feedback'),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: feedbackFileFilter
});
const feedbackCommentUpload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    // Busboy truncates at the limit, so reserve one byte to allow exactly 10 MiB.
    limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1, fields: 2, fieldSize: 20_000 },
    fileFilter: feedbackFileFilter
});

// ── Training content upload ──
const upload = multer({
    storage: makeStorage('videos'),
    limits: { fileSize: 500 * 1024 * 1024, files: 20 },
    fileFilter: (_req, file, cb) => {
        if ([TRAINING_COVER_FIELD, TRAINING_BADGE_FIELD].includes(file.fieldname)) {
            if (!matchesAllowedType(file, IMAGE_MIMES)) {
                return cb(new Error('Eğitim görseli JPEG, PNG, GIF veya WebP olmalıdır'));
            }
            return cb(null, true);
        }
        if (!TRAINING_LESSON_FIELD.test(file.fieldname)) {
            return cb(new Error('Geçersiz eğitim dosyası alanı'));
        }
        if (!matchesAllowedType(file, TRAINING_MIMES)) {
            return cb(new Error('Sadece video veya PDF dosyalari kabul edilir'));
        }
        cb(null, true);
    }
});

const hasKnownSignature = (buffer, mimetype) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
    if (mimetype === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
    if (mimetype === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimetype === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString());
    if (mimetype === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    if (mimetype === 'video/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (mimetype === 'video/x-msvideo') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'AVI ';
    if (mimetype === 'video/mp4' || mimetype === 'video/quicktime') return buffer.subarray(4, 8).toString() === 'ftyp';
    return false;
};

const readHeader = async (file) => {
    if (file.buffer) return file.buffer.subarray(0, 32);
    if (!file.path) return Buffer.alloc(0);
    const handle = await fs.promises.open(file.path, 'r');
    try {
        const buffer = Buffer.alloc(32);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
};

const removeRejectedFile = async (file) => {
    if (file?.path) await fs.promises.unlink(file.path).catch(() => undefined);
};

const verifyUploadSignatures = async (req, _res, next) => {
    const files = [
        ...(req.file ? [req.file] : []),
        ...(Array.isArray(req.files) ? req.files : [])
    ];
    try {
        const coverFiles = files.filter((file) => file.fieldname === TRAINING_COVER_FIELD);
        const badgeFiles = files.filter((file) => file.fieldname === TRAINING_BADGE_FIELD);
        if (badgeFiles.length > 1 || badgeFiles.some(file => Number(file.size || 0) > TRAINING_COVER_MAX_SIZE)) {
            await Promise.all(files.map(removeRejectedFile));
            return next(new Error('Yalnızca bir rozet görseli yüklenebilir; en fazla 10 MB olabilir'));
        }
        if (coverFiles.length > 1) {
            await Promise.all(files.map(removeRejectedFile));
            return next(new Error('Yalnızca bir kapak görseli yüklenebilir'));
        }
        if (coverFiles.some((file) => Number(file.size || 0) > TRAINING_COVER_MAX_SIZE)) {
            await Promise.all(files.map(removeRejectedFile));
            return next(new Error('Kapak görseli en fazla 10 MB olabilir'));
        }
        for (const file of files) {
            const header = await readHeader(file);
            if (!hasKnownSignature(header, file.mimetype)) {
                await Promise.all(files.map(removeRejectedFile));
                return next(new Error('Dosya içeriği bildirilen dosya türüyle eşleşmiyor'));
            }
        }
        next();
    } catch (error) {
        await Promise.all(files.map(removeRejectedFile));
        next(error);
    }
};

module.exports = {
    upload, docUpload, feedbackUpload, feedbackCommentUpload, avatarUpload, newsUpload, announcementUpload,
    uploadToCloudinary, deleteFromCloudinary, deleteFromCloudinaryStrict,
    useCloudinary, verifyUploadSignatures
};
