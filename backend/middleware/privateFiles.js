const express = require('express');
const path = require('node:path');

const privateFileHandler = (rootDirectory) => {
    const fallback = express.static(rootDirectory, {
        dotfiles: 'deny',
        fallthrough: false,
        index: false,
        setHeaders(res) {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, no-store');
        }
    });

    return (req, res, next) => {
        if (process.env.X_ACCEL_REDIRECT_ENABLED !== 'true') {
            return fallback(req, res, next);
        }

        const relativePath = path.posix
            .normalize(`/${String(req.path || '').replace(/\\/g, '/')}`)
            .replace(/^\/+/, '');
        if (!relativePath || relativePath.startsWith('..') || relativePath.includes('/../')) {
            return res.status(400).json({ error: 'INVALID_FILE_PATH' });
        }

        res.setHeader('X-Accel-Redirect', `/protected-files/${relativePath}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).end();
    };
};

module.exports = {
    privateFileHandler
};
