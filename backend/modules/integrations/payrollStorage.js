const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createUploadStorageService } = require('../../services/uploadStorageService');

// Payrolls always use the authenticated local documents route, never public cloud URLs.
const createPayrollStorage = () => ({
    async store(file) {
        const filename = `payroll-${randomUUID()}.pdf`;
        const folder = path.resolve(__dirname, '../../uploads/documents');
        await fs.mkdir(folder, { recursive: true });
        const target = path.join(folder, filename);
        try {
            await fs.writeFile(target, file.buffer, { flag: 'wx', mode: 0o600 });
        } catch (error) {
            await fs.unlink(target).catch(() => {});
            throw error;
        }
        return { filePath: `/uploads/documents/${filename}`, provider: 'local', storageKey: filename };
    },
    remove: stored => createUploadStorageService().remove(stored)
});
module.exports = { createPayrollStorage };
