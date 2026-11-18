const test = require('node:test');
const assert = require('node:assert/strict');
const { createSurveyService } = require('../modules/surveys/surveyService');

test('anket yaniti zorunlu sorulari ve bilinen soru kayitlarini korur', async () => {
    let persisted;
    const repository = {
        getActiveSurvey: async () => ({ id: 4, status: 'active' }),
        getExistingResponse: async () => null,
        getQuestions: async () => [
            { id: 10, is_required: 1, question_type: 'text' },
            { id: 11, is_required: 0, question_type: 'multiple_choice' }
        ],
        createResponse: async (surveyId, userId, answers) => {
            persisted = { surveyId, userId, answers };
            return 21;
        }
    };
    const service = createSurveyService(repository);

    await assert.rejects(
        service.submitResponse(4, 7, [{ question_id: 11, value: ['A'] }]),
        error => error.status === 400 && error.message === 'Zorunlu soruların tamamını yanıtlayın'
    );

    const responseId = await service.submitResponse(4, 7, [
        { question_id: 10, value: 'Yanıt' },
        { question_id: 11, value: ['A', 'B'] },
        { question_id: 999, value: 'Yok sayılmalı' }
    ]);
    assert.equal(responseId, 21);
    assert.deepEqual(persisted, {
        surveyId: 4,
        userId: 7,
        answers: [
            { questionId: 10, value: 'Yanıt' },
            { questionId: 11, value: '["A","B"]' }
        ]
    });
});

test('anket olusturma mevcut soru sirasi ve secenek formatini korur', async () => {
    let persisted;
    const service = createSurveyService({
        createSurvey: async data => {
            persisted = data;
            return 8;
        }
    });
    const id = await service.createSurvey({
        title: 'Memnuniyet',
        description: '',
        status: 'draft',
        questions: [{
            question_text: 'Seçiminiz',
            question_type: 'single_choice',
            options: ['İyi', 'Kötü'],
            is_required: true
        }]
    }, 3);

    assert.equal(id, 8);
    assert.equal(persisted.createdBy, 3);
    assert.deepEqual(persisted.questions, [{
        text: 'Seçiminiz',
        type: 'single_choice',
        options: '["İyi","Kötü"]',
        isRequired: true,
        orderIndex: 0
    }]);
});
