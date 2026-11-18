async function ensureDefaultDocumentRequestTypes(db) {
    const defaults = [
        { name: 'Gelir belgesi', order: 1, fields: [{ label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true }] },
        { name: 'İmza sirküleri', order: 2, fields: [{ label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true }] },
        { name: 'Vergi levhası', order: 3, fields: [{ label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true }] },
        { name: 'Faaliyet belgesi', order: 4, fields: [{ label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true }] },
        { name: 'Ticaret sicil gazetesi', order: 5, fields: [{ label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true }] },
        {
            name: 'Vize talep belgesi',
            order: 6,
            fields: [
                { label: 'Talep nedeni / kullanım amacı', key: 'purpose', type: 'textarea', required: true },
                { label: 'Gidilecek ülke', key: 'country', type: 'text', required: true },
                { label: 'Konsolosluk / kurum', key: 'institution', type: 'text', required: false },
                { label: 'Gidiş tarihi', key: 'departure_date', type: 'date', required: true },
                { label: 'Dönüş tarihi', key: 'return_date', type: 'date', required: true },
                { label: 'Pasaport no', key: 'passport_no', type: 'text', required: false },
                { label: 'Ek açıklama', key: 'extra_note', type: 'textarea', required: false }
            ]
        }
    ];

    for (const item of defaults) {
        let type = await db.get('SELECT id FROM document_request_types WHERE name = ?', [item.name]);
        if (!type) {
            const result = await db.run(
                'INSERT INTO document_request_types (name, description, is_active, order_index) VALUES (?, ?, ?, ?)',
                [item.name, '', 1, item.order]
            );
            type = { id: result.lastID };
        }

        for (let i = 0; i < item.fields.length; i++) {
            const field = item.fields[i];
            const existing = await db.get(
                'SELECT id FROM document_request_fields WHERE type_id = ? AND field_key = ?',
                [type.id, field.key]
            );
            if (!existing) {
                await db.run(
                    'INSERT INTO document_request_fields (type_id, label, field_key, field_type, is_required, order_index, placeholder) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [type.id, field.label, field.key, field.type, field.required ? 1 : 0, i + 1, '']
                );
            }
        }
    }
}

async function ensurePolyvalenceLevelDefinitions(db) {
    const defaults = [
        { value: 0, label: 'Bilgisi yok', description: 'Bu yetkinlikte henüz uygulama bilgisi bulunmuyor.', color: '#ef4444' },
        { value: 1, label: 'Temel bilgi', description: 'Gözetim ve yönlendirme ile uygulayabilir.', color: '#f59e0b' },
        { value: 2, label: 'Uygulayabilir', description: 'Standart işi bağımsız ve güvenli biçimde uygulayabilir.', color: '#3b82f6' },
        { value: 3, label: 'Yetkin', description: 'Yetkinliği ileri seviyede ve tutarlı biçimde uygulayabilir.', color: '#16a34a' }
    ];

    for (const item of defaults) {
        const existing = await db.get(
            'SELECT level_value FROM polyvalence_level_definitions WHERE level_value = ?',
            [item.value]
        );
        if (!existing) {
            await db.run(
                'INSERT INTO polyvalence_level_definitions (level_value, label, description, color) VALUES (?, ?, ?, ?)',
                [item.value, item.label, item.description, item.color]
            );
        }
    }
}

module.exports = {
    ensureDefaultDocumentRequestTypes,
    ensurePolyvalenceLevelDefinitions
};
