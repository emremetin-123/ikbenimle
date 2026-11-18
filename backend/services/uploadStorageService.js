const fs = require('node:fs');
const path = require('node:path');
const {
    uploadToCloudinary,
    deleteFromCloudinaryStrict,
    useCloudinary
} = require('../config/multer');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const resolveLocalPath = filePath => {
    if (!String(filePath || '').startsWith('/uploads/')) return null;
    const resolved = path.resolve(__dirname, '..', String(filePath).replace(/^\//, ''));
    return resolved.startsWith(`${uploadsRoot}${path.sep}`) ? resolved : null;
};

const cloudinaryKeyFromUrl = filePath => {
    try {
        const parts = new URL(filePath).pathname.split('/upload/');
        if (parts.length !== 2) return null;
        const segments = parts[1].split('/').filter(Boolean);
        if (/^v\d+$/.test(segments[0] || '')) segments.shift();
        if (segments.length < 2) return null;
        segments[segments.length - 1] = segments[segments.length - 1].replace(/\.[^.]+$/, '');
        return segments.join('/');
    } catch {
        return null;
    }
};

const createUploadStorageService = (dependencies = {}) => {
    const cloudinaryEnabled = dependencies.useCloudinary ?? useCloudinary;
    const cloudinaryUpload = dependencies.uploadToCloudinary || uploadToCloudinary;
    const cloudinaryDelete = dependencies.deleteFromCloudinary || deleteFromCloudinaryStrict;
    const unlink = dependencies.unlink || (target => fs.promises.unlink(target));

    const store = async (file, folder) => {
        if (!file) return null;
        if (cloudinaryEnabled) {
            if (!file.buffer) throw new Error('UPLOAD_MEMORY_BUFFER_MISSING');
            const resourceType = file.mimetype?.startsWith('image/') ? 'image' : 'raw';
            const uploaded = await cloudinaryUpload(file.buffer, folder, {
                resource_type: resourceType
            });
            return {
                filePath: uploaded.url,
                provider: 'cloudinary',
                storageKey: uploaded.public_id
            };
        }
        if (!file.filename) throw new Error('UPLOAD_DISK_FILENAME_MISSING');
        return {
            filePath: `/uploads/${folder}/${file.filename}`,
            provider: 'local',
            storageKey: file.filename
        };
    };

    const remove = async (stored, attempts = 3) => {
        if (!stored?.filePath) return;
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                if (stored.provider === 'cloudinary' || stored.filePath.startsWith('http')) {
                    const storageKey = stored.storageKey || cloudinaryKeyFromUrl(stored.filePath);
                    if (!storageKey) throw new Error('CLOUDINARY_STORAGE_KEY_MISSING');
                    await cloudinaryDelete(storageKey, {
                        resource_type: stored.filePath.match(/\.(?:jpe?g|png|gif|webp)(?:\?|$)/i)
                            ? 'image'
                            : 'raw'
                    });
                    return;
                }
                const localPath = resolveLocalPath(stored.filePath);
                if (!localPath) return;
                await unlink(localPath).catch(error => {
                    if (error.code !== 'ENOENT') throw error;
                });
                return;
            } catch (error) {
                lastError = error;
                if (attempt < attempts) await wait(25 * attempt);
            }
        }
        throw lastError;
    };

    return { store, remove };
};

module.exports = {
    cloudinaryKeyFromUrl,
    createUploadStorageService,
    resolveLocalPath
};
