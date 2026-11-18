const { promises: fs } = require('node:fs');
const {
    uploadToCloudinary,
    useCloudinary
} = require('../../config/multer');

const getCloudinaryPublicIdFromUrl = url => {
    if (!url?.includes('/upload/')) return null;
    const uploadPath = url.split('/upload/')[1];
    if (!uploadPath) return null;
    const parts = uploadPath.split('/').filter(Boolean);
    if (parts[0]?.startsWith('v') && /^\d+$/.test(parts[0].slice(1))) {
        parts.shift();
    }
    const publicId = parts.join('/').replace(/\.[^/.]+$/, '');
    return publicId || null;
};

const getResourceType = file => {
    if (file?.mimetype?.startsWith('video/')) return 'video';
    if (file?.mimetype?.startsWith('image/')) return 'image';
    return 'raw';
};

const storeTrainingContent = async (file, uploadedFiles) => {
    if (useCloudinary && file.buffer) {
        const resourceType = getResourceType(file);
        const uploaded = await uploadToCloudinary(file.buffer, 'videos', {
            resource_type: resourceType
        });
        uploadedFiles.push({
            public_id: uploaded.public_id,
            resource_type: resourceType
        });
        return uploaded.url;
    }
    return `/uploads/videos/${file.filename}`;
};

const resolveTrainingCoverImage = async (files, fallbackUrl, uploadedFiles) => {
    const coverFile = (files || []).find(file => file.fieldname === 'cover_image_file');
    if (!coverFile) return fallbackUrl || '';
    if (useCloudinary && coverFile.buffer) {
        const uploaded = await uploadToCloudinary(coverFile.buffer, 'training-covers', {
            resource_type: 'image'
        });
        uploadedFiles.push({ public_id: uploaded.public_id, resource_type: 'image' });
        return uploaded.url;
    }
    return `/uploads/videos/${coverFile.filename}`;
};

const isEnabled = value => value === true || value === 1 || value === '1' || value === 'true';
const validateTrainingBadge = (body, files, original = null) => {
    const enabled = body.awards_badge === undefined ? true : isEnabled(body.awards_badge);
    const file = (files || []).find(item => item.fieldname === 'badge_image_file');
    if (file && !enabled) return 'Rozet görseli yüklemek için Rozet verilsin seçeneğini açın.';
    const existing = !isEnabled(body.remove_badge_image) && original?.badge_image_url;
    if (enabled && !file && !existing) return 'Rozet verilecek eğitimler için rozet görseli yükleyin.';
    return null;
};

const resolveTrainingBadgeImage = async (files, fallbackUrl, uploadedFiles) => {
    const file = (files || []).find(item => item.fieldname === 'badge_image_file');
    if (!file) return fallbackUrl || '';
    if (useCloudinary && file.buffer) {
        const uploaded = await uploadToCloudinary(file.buffer, 'training-badges', { resource_type: 'image' });
        uploadedFiles.push({ public_id: uploaded.public_id, resource_type: 'image' });
        return uploaded.url;
    }
    return `/uploads/videos/${file.filename}`;
};

const cleanupLocalTrainingUploads = async files => {
    await Promise.all((files || []).map(async file => {
        if (!file?.path) return;
        await fs.unlink(file.path).catch(() => undefined);
    }));
};

module.exports = {
    getCloudinaryPublicIdFromUrl,
    storeTrainingContent,
    resolveTrainingCoverImage,
    resolveTrainingBadgeImage,
    validateTrainingBadge,
    cleanupLocalTrainingUploads
};
