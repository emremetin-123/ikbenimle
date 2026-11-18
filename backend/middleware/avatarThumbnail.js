const { createImageThumbnail } = require('./imageThumbnail');

const avatarThumbnail = rootDirectory => createImageThumbnail(rootDirectory, {
    folder: 'avatars', sizeKey: 'avatarSize', sizes: [160, 320],
    pattern: /^\/avatars\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    fit: 'cover', quality: 78
});

module.exports = { avatarThumbnail };
