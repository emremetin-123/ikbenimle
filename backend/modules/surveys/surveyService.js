const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');
const {
    normalizeQuestion,
    normalizeAnswerValue,
    csvEscape,
    formatTurkeyDateTime,
    formatExportAnswer,
    parseAnswerValue
} = require('./surveySupport');

const sortDirection = order => order === 'asc' ? 'ASC' : 'DESC';

const createSurveyService = repository => ({
    async listEmployeeSurveys(userId, query) {
        const pagination = parsePagination(query);
        const sortColumn = query.sort === 'title' ? 's.title' : 's.created_at';
        const [total, rows] = await Promise.all([
            repository.countEmployeeSurveys(query.search),
            repository.listEmployeeSurveys(
                userId, query, pagination, sortColumn, sortDirection(query.order)
            )
        ]);
        return paginatedResponse(rows, total?.total, pagination.page, pagination.pageSize);
    },
    async getEmployeeSurvey(surveyId, userId) {
        const survey = await repository.getActiveSurveyForUser(surveyId, userId);
        if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND', 'Anket bulunamadı');
        const questions = await repository.getQuestions(surveyId);
        return { ...survey, questions: questions.map(normalizeQuestion) };
    },
    async submitResponse(surveyId, userId, answers) {
        const survey = await repository.getActiveSurvey(surveyId);
        if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND', 'Anket bulunamadı');
        if (await repository.getExistingResponse(surveyId, userId)) {
            throw new AppError(409, 'SURVEY_ALREADY_ANSWERED', 'Bu anketi zaten yanıtladınız');
        }
        const questions = await repository.getQuestions(surveyId, false);
        const questionMap = new Map(questions.map(question => [Number(question.id), question]));
        for (const question of questions) {
            const answer = answers.find(item => Number(item.question_id) === Number(question.id));
            const isEmpty = !answer || answer.value === '' || answer.value == null
                || (Array.isArray(answer.value) && answer.value.length === 0);
            if (question.is_required && isEmpty) {
                throw new AppError(
                    400,
                    'SURVEY_REQUIRED_ANSWERS_MISSING',
                    'Zorunlu soruların tamamını yanıtlayın'
                );
            }
        }
        const normalizedAnswers = answers.flatMap(answer => {
            const question = questionMap.get(Number(answer.question_id));
            if (!question) return [];
            const value = normalizeAnswerValue(answer.value);
            if (String(value).length > 5000) {
                throw new AppError(400, 'SURVEY_ANSWER_TOO_LONG', 'Anket yaniti cok uzun');
            }
            return [{ questionId: question.id, value }];
        });
        try {
            return await repository.createResponse(surveyId, userId, normalizedAnswers);
        } catch (error) {
            if (/unique/i.test(String(error?.message || ''))) {
                throw new AppError(409, 'SURVEY_ALREADY_ANSWERED', 'Bu anketi zaten yanıtladınız');
            }
            throw error;
        }
    },
    async listAdminSurveys(query) {
        const pagination = parsePagination(query);
        const sortColumn = query.sort === 'title' ? 's.title' : 's.created_at';
        const [total, rows] = await Promise.all([
            repository.countAdminSurveys(query),
            repository.listAdminSurveys(
                query, pagination, sortColumn, sortDirection(query.order)
            )
        ]);
        return paginatedResponse(rows, total?.total, pagination.page, pagination.pageSize);
    },
    createSurvey(body, userId) {
        return repository.createSurvey({
            title: body.title,
            description: body.description || null,
            status: body.status || 'draft',
            createdBy: userId,
            questions: body.questions.map((question, index) => ({
                text: question.question_text,
                type: question.question_type || 'single_choice',
                options: JSON.stringify(
                    Array.isArray(question.options) ? question.options.filter(Boolean) : []
                ),
                isRequired: Boolean(question.is_required),
                orderIndex: index
            }))
        });
    },
    updateStatus: (surveyId, status) => repository.updateStatus(surveyId, status),
    deleteSurvey: surveyId => repository.deleteSurvey(surveyId),
    async exportSurvey(surveyId) {
        const survey = await repository.getSurvey(surveyId);
        if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND', 'Anket bulunamadı');
        const rows = await repository.listExportRows(surveyId);
        const headers = ['Anket', 'Yanıt No', 'Tarih', 'Çalışan', 'Departman', 'Pozisyon', 'Soru', 'Soru Tipi', 'Cevap'];
        const lines = rows.map(row => [
            row.survey_title, row.response_id, formatTurkeyDateTime(row.submitted_at),
            row.name, row.department, row.position, row.question_text, row.question_type,
            formatExportAnswer(row.answer_value, row.question_type)
        ].map(csvEscape).join(';'));
        const safeName = String(survey.title || 'anket').toLowerCase()
            .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'anket';
        return {
            fileName: `${safeName}-yanitlari.csv`,
            csv: ['\uFEFF' + headers.join(';'), ...lines].join('\n')
        };
    },
    async getResults(surveyId, query) {
        const survey = await repository.getSurvey(surveyId);
        if (!survey) throw new AppError(404, 'SURVEY_NOT_FOUND', 'Anket bulunamadı');
        const questions = (await repository.getQuestions(surveyId)).map(normalizeQuestion);
        const pagination = parsePagination(query);
        const sortColumn = query.sort === 'name' ? 'u.name' : 'r.submitted_at';
        const { count, rows: respondents } = await repository.listResultRespondents(
            surveyId, query, pagination, sortColumn, sortDirection(query.order)
        );
        const [answers, aggregateRows] = await Promise.all([
            repository.listAnswersForResponses(respondents.map(item => item.response_id)),
            repository.listAggregateAnswers(surveyId, query.search)
        ]);
        const questionMap = new Map(questions.map(question => [Number(question.id), question]));
        const answerRows = answers.map(answer => ({
            ...answer,
            answer_value: parseAnswerValue(
                answer.answer_value,
                questionMap.get(Number(answer.question_id))?.question_type
            )
        }));
        const answerSummary = {};
        for (const answer of aggregateRows) {
            const question = questionMap.get(Number(answer.question_id));
            if (!question) continue;
            const key = String(answer.question_id);
            if (!answerSummary[key]) answerSummary[key] = { total: 0, counts: {} };
            answerSummary[key].total += 1;
            const parsed = parseAnswerValue(answer.answer_value, question.question_type);
            for (const value of Array.isArray(parsed) ? parsed : [parsed]) {
                const option = String(value);
                answerSummary[key].counts[option] = (answerSummary[key].counts[option] || 0) + 1;
            }
        }
        return {
            survey,
            questions,
            answers: answerRows,
            answer_summary: answerSummary,
            response_count: count,
            pagination: paginatedResponse([], count, pagination.page, pagination.pageSize).pagination
        };
    }
});

module.exports = { createSurveyService };
