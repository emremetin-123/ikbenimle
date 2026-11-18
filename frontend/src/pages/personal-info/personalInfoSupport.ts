import type { Profile } from '../../types';

export const profileUpdatePayload = (profile: Profile) => ({
    phone: profile.phone || null,
    address: profile.address || null,
    emergency_contact_name: profile.emergency_contact_name || null,
    emergency_contact_phone: profile.emergency_contact_phone || null,
    blood_type: profile.blood_type || null,
    birth_date: profile.birth_date || null,
    email: profile.email || null,
    clothing_top: profile.clothing_top || null,
    clothing_bottom: profile.clothing_bottom || null,
    shoe_size: profile.shoe_size || null,
    education: profile.education || null,
    hobbies: profile.hobbies || null,
    skills: profile.skills || null,
    education_entries: (profile.education_entries || []).map(entry => ({
        school: entry.school,
        department: entry.department ?? null,
        start_year: entry.start_year ?? null,
        end_year: entry.end_year ?? null,
        is_current: entry.is_current,
    })),
    skill_tags: profile.skill_tags || [],
    hobby_tags: profile.hobby_tags || [],
});
