const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');

// Session and object authorization must run before this handler, including cache hits.
const createImageThumbnail = (rootDirectory, options) => {
    const cache = new Map();
    const pending = new Map();
    const folderRoot = path.resolve(rootDirectory, options.folder);
    return async (req, res, next) => {
        if (!['GET', 'HEAD'].includes(req.method) || req.query[options.sizeKey] === undefined) return next();
        let relative;
        try { relative = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
        if (!relative.startsWith('/' + options.folder + '/')) return next();
        const size = Number(req.query[options.sizeKey]);
        if (!options.pattern.test(relative) || !options.sizes.includes(size)) return res.sendStatus(400);
        try {
            if (options.accept && !await options.accept(relative)) return next();
            const filename = await fs.realpath(path.join(folderRoot, path.basename(relative)));
            if (path.dirname(filename) !== folderRoot) return res.sendStatus(400);
            const stat = await fs.stat(filename);
            const key = `${filename}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}:${size}`;
            let buffer = cache.get(key);
            if (!buffer) {
                let task = pending.get(key);
                if (!task) {
                    task = (async () => {
                        const input = sharp(filename, { limitInputPixels: 36_000_000 });
                        // Preserve animated originals instead of silently flattening uploaded designs.
                        if (options.preserveAnimation && (await input.metadata()).pages > 1) return null;
                        return input.rotate().resize(size, size, { fit: options.fit, withoutEnlargement: true })
                            .webp({ quality: options.quality }).toBuffer();
                    })();
                    pending.set(key, task);
                }
                try { buffer = await task; } finally { pending.delete(key); }
                if (!buffer) return next();
                if (!cache.has(key)) {
                    if (cache.size >= 128) cache.delete(cache.keys().next().value);
                    if (buffer.length <= 256 * 1024) cache.set(key, buffer);
                }
            } else { cache.delete(key); cache.set(key, buffer); }
            res.setHeader('Cache-Control', 'private, no-cache');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            return res.type('image/webp').send(buffer);
        } catch {
            // Existing originals remain available for damaged or unsupported images.
            return next();
        }
    };
};

module.exports = { createImageThumbnail };
