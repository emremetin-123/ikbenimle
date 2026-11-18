const { AppError } = require('./http');

const formatIssues = (issues) => issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code
}));

const validate = (schemas) => (req, _res, next) => {
    try {
        for (const source of ['params', 'query', 'body']) {
            if (!schemas[source]) continue;
            const result = schemas[source].safeParse(req[source]);
            if (!result.success) {
                throw new AppError(
                    400,
                    'VALIDATION_ERROR',
                    'Gönderilen bilgiler geçerli değil.',
                    formatIssues(result.error.issues)
                );
            }
            req[source] = result.data;
        }
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { validate };
