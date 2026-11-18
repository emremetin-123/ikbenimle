const sqliteSchema = {
    people: require('../../db/schema/sqlite/peopleAndTrainingSchema'),
    operations: require('../../db/schema/sqlite/operationsSchema'),
    polyvalence: require('../../db/schema/sqlite/polyvalenceSchema'),
    legacy: require('../legacy/sqliteUpgrades')
};
const postgresSchema = {
    people: require('../../db/schema/postgres/peopleAndTrainingSchema'),
    operations: require('../../db/schema/postgres/operationsSchema'),
    polyvalence: require('../../db/schema/postgres/polyvalenceSchema'),
    legacy: { applyLegacyUpgrades: async () => undefined }
};
const {
    ensureDefaultDocumentRequestTypes,
    ensurePolyvalenceLevelDefinitions
} = require('./baseReferenceData');

module.exports = [
    {
        version: '000_initial_schema',
        checksumMaterial: [
            ...Object.values(sqliteSchema),
            ...Object.values(postgresSchema)
        ].flatMap(module => Object.values(module))
            .map(value => value.toString())
            .concat(
                ensureDefaultDocumentRequestTypes.toString(),
                ensurePolyvalenceLevelDefinitions.toString()
            )
            .join('\n'),
        async up(db, dialect) {
            const schema = dialect === 'postgres'
                ? postgresSchema
                : sqliteSchema;
            await schema.people.createPeopleAndTrainingSchema(db);
            await schema.operations.createOperationsSchema(db);
            await schema.polyvalence.createPolyvalenceSchema(db);
            await schema.legacy.applyLegacyUpgrades(db);

            // Required reference data is versioned with the schema, not seeded at startup.
            await ensureDefaultDocumentRequestTypes(db);
            await ensurePolyvalenceLevelDefinitions(db);
        }
    }
];
