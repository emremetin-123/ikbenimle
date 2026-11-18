const { randomUUID } = require('node:crypto');
const { writeFile, unlink } = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '../../uploads/feedback-comments');

async function storeCommentAttachment(file) {
    const basename = path.posix.basename(file.originalname.replace(/\\/g, '/'));
    const extension = path.extname(basename).toLowerCase();
    const key = randomUUID() + extension;
    const stem = basename.slice(0, -extension.length).replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 160);
    const location = path.join(root, key);
    try {
        await writeFile(location, file.buffer, { flag: 'wx' });
    } catch (error) {
        if (error.code !== 'EEXIST') await removeCommentAttachment(key);
        throw error;
    }
    return { key, name: `${stem || 'Ek dosya'}${extension}` };
}

async function removeCommentAttachment(key) {
    try {
        await unlink(path.join(root, key));
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Geri bildirim yorum eki temizlenemedi.', error.code);
    }
}

module.exports = { root, storeCommentAttachment, removeCommentAttachment };
