const { createImageThumbnail } = require('./imageThumbnail');

const badgeThumbnail = (db, rootDirectory) => createImageThumbnail(rootDirectory, {
    folder: 'videos', sizeKey: 'badgeSize', sizes: [256],
    pattern: /^\/videos\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:png|jpe?g|webp|gif)$/i,
    fit: 'inside', quality: 84, preserveAnimation: true,
    accept: async relative => Boolean(await db.get('SELECT id FROM videos WHERE badge_image_url = ? LIMIT 1', ['/uploads' + relative]))
});

module.exports = { badgeThumbnail };
