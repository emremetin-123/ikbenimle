const path = require('path');
const fs = require('fs');
const {
    uploadToCloudinary,
    deleteFromCloudinary,
    useCloudinary
} = require('../../config/multer');

const createProfilePhotoService = repository => ({
    async replacePhoto(userId, file) {
        const old = await repository.getPhoto(userId);
        let photoPath;
        let photoPublicId = null;
        if (useCloudinary && file.buffer) {
            const result = await uploadToCloudinary(file.buffer, 'avatars', {
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
            });
            photoPath = result.url;
            photoPublicId = result.public_id;
        } else {
            photoPath = `/uploads/avatars/${file.filename}`;
        }

        await repository.savePhoto(userId, photoPath, photoPublicId);
        if (old?.photo_public_id) {
            await deleteFromCloudinary(old.photo_public_id).catch(() => undefined);
        } else if (old?.photo_path?.startsWith('/uploads/')) {
            const oldFile = path.join(__dirname, '..', '..', old.photo_path.replace(/^\//, ''));
            try {
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            } catch {
                // Yeni fotoğraf kaydedildi; eski dosya temizliği sonraki bakımda tekrar denenebilir.
            }
        }
        return photoPath;
    }
});

module.exports = { createProfilePhotoService };
