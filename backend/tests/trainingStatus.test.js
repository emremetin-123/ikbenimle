const test = require('node:test');
const assert = require('node:assert/strict');
const { isSuccessfulCompletion } = require('../modules/training/trainingStatus');

test('sinavsiz tamamlanan egitim basarili tamamlanmis sayilir', () => {
    assert.equal(isSuccessfulCompletion({
        status: 'completed',
        requires_quiz: 0,
        quiz_score: null,
        pass_score: 70
    }), true);
});

test('sinav zorunlu egitimde puan baraji uygulanir', () => {
    assert.equal(isSuccessfulCompletion({
        status: 'completed',
        requires_quiz: 1,
        quiz_score: 69,
        pass_score: 70
    }), false);
    assert.equal(isSuccessfulCompletion({
        status: 'completed',
        requires_quiz: true,
        quiz_score: 70,
        pass_score: 70
    }), true);
});

test('tamamlanmamis egitim puandan bagimsiz basarili sayilmaz', () => {
    assert.equal(isSuccessfulCompletion({
        status: 'assigned',
        requires_quiz: 0,
        quiz_score: null,
        pass_score: 0
    }), false);
});
