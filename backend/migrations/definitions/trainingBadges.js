module.exports = [{
    version: '023_training_badge_images',
    async up(db) {
        await db.exec('ALTER TABLE videos ADD COLUMN badge_image_url TEXT;');
    },
    async down(db) {
        await db.exec('ALTER TABLE videos DROP COLUMN badge_image_url;');
    }
}];
