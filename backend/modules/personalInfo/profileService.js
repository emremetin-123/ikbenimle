const { z } = require('zod');
const { createProfileRepository } = require('./profileRepository');

const emptyToNull = schema => z.preprocess(
    value => value === '' || value === undefined ? null : value,
    schema.nullable()
);

const nullableText = max => emptyToNull(z.string().trim().max(max));
const nullablePhone = emptyToNull(
    z.string().regex(/^\d{10,15}$/, 'Telefon numarası 10-15 rakam olmalıdır.')
);
const nullableDate = emptyToNull(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, 'Geçerli bir tarih girin.')
);

const educationEntrySchema = z.object({
    school: z.string().trim().min(1).max(200),
    department: nullableText(200).default(null),
    start_year: z.number().int().min(1900).max(2200).nullable().default(null),
    end_year: z.number().int().min(1900).max(2200).nullable().default(null),
    is_current: z.boolean().default(false)
}).strict().superRefine((entry, context) => {
    if (entry.start_year && entry.end_year && entry.end_year < entry.start_year) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['end_year'],
            message: 'Bitiş yılı başlangıç yılından önce olamaz.'
        });
    }
    if (entry.is_current && entry.end_year) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['end_year'],
            message: 'Devam eden eğitimde bitiş yılı girilemez.'
        });
    }
});

const profileTagSchema = z.string().trim().min(1).max(80);

const profileUpdateSchema = z.object({
    phone: nullablePhone.default(null),
    address: nullableText(1000).default(null),
    emergency_contact_name: nullableText(150).default(null),
    emergency_contact_phone: nullablePhone.default(null),
    blood_type: emptyToNull(
        z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'])
    ).default(null),
    birth_date: nullableDate.default(null),
    email: emptyToNull(z.string().trim().email().max(255)).default(null),
    clothing_top: emptyToNull(
        z.enum(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'])
    ).default(null),
    clothing_bottom: emptyToNull(
        z.enum(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'])
    ).default(null),
    shoe_size: emptyToNull(
        z.string().regex(/^\d{2}$/, 'Ayakkabı numarası iki rakam olmalıdır.')
    ).default(null),
    education: nullableText(1000).default(null),
    hobbies: nullableText(500).default(null),
    skills: nullableText(500).default(null),
    education_entries: z.array(educationEntrySchema).max(20).optional(),
    skill_tags: z.array(profileTagSchema).max(30).optional(),
    hobby_tags: z.array(profileTagSchema).max(30).optional()
}).strict();

const normalizeProfile = profile => ({
    ...profile,
    birth_date: profile?.birth_date
        ? (
            profile.birth_date instanceof Date
                ? profile.birth_date.toISOString().slice(0, 10)
                : String(profile.birth_date).slice(0, 10)
        )
        : null
});

const createProfileService = repository => ({
    async getProfile(userId) {
        const profile = await repository.getProfile(userId);
        if (!profile) return null;
        const [educationEntries, skillTags, hobbyTags] = await Promise.all([
            repository.listEducation(userId),
            repository.listInterests(userId, 'skill'),
            repository.listInterests(userId, 'hobby')
        ]);
        return normalizeProfile({
            ...profile,
            education_entries: educationEntries.map(entry => ({
                ...entry,
                is_current: Boolean(entry.is_current)
            })),
            skill_tags: skillTags.map(item => item.label),
            hobby_tags: hobbyTags.map(item => item.label)
        });
    },
    async updateProfile(userId, profile) {
        await repository.saveProfile(userId, profile);
        return this.getProfile(userId);
    }
});

// Çalışan modülündeki mevcut import sözleşmesini koruyan ince uyumluluk fonksiyonları.
const getProfile = (db, userId) => createProfileService(createProfileRepository(db)).getProfile(userId);
const updateProfile = (db, userId, profile) => (
    createProfileService(createProfileRepository(db)).updateProfile(userId, profile)
);

module.exports = {
    profileUpdateSchema,
    createProfileService,
    getProfile,
    updateProfile
};
