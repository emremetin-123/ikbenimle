const test = require('node:test');
const assert = require('node:assert/strict');
const { convertPlaceholders } = require('../db/postgresAdapter');

test('PostgreSQL adapter yalnizca tirnak disindaki placeholderlari donusturur', () => {
    assert.equal(
        convertPlaceholders(`SELECT '?' AS literal, "?" AS identifier, ? AS first, ? AS second`),
        `SELECT '?' AS literal, "?" AS identifier, $1 AS first, $2 AS second`
    );
});

test('PostgreSQL adapter kacirilmis SQL tirnaklarindaki soru isaretini korur', () => {
    assert.equal(
        convertPlaceholders(`SELECT 'it''s ?' AS literal, ? AS value`),
        `SELECT 'it''s ?' AS literal, $1 AS value`
    );
});
