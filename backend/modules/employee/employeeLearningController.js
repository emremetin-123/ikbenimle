const send = (res, outcome) => res.status(outcome.status).json(outcome.body);
const internalError = (res, error, label) => {
    if (label) console.error(label, error);
    return res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'INTERNAL_SERVER_ERROR'
            : error.message
    });
};

const createEmployeeLearningController = service => ({
    async summary(req, res) {
        res.json(await service.getSummary(req.user.id));
    },

    async list(req, res) {
        res.json(await service.listTrainings(req.user.id, req.query));
    },

    async detail(req, res) {
        try {
            return send(res, await service.getVideoDetail(req.params.id, req.user.id));
        } catch (error) {
            return internalError(res, error, 'Fetch video details error:');
        }
    },

    async submitQuiz(req, res) {
        try {
            return send(res, await service.submitQuiz(
                req.params.id,
                req.user.id,
                req.body.answers || {},
                req
            ));
        } catch (error) {
            return internalError(res, error);
        }
    },

    async confirmAssignment(req, res) {
        try {
            return send(res, await service.confirmAssignment(
                req.params.id,
                req.user.id,
                req
            ));
        } catch (error) {
            return internalError(res, error);
        }
    },

    async startWatch(req, res) {
        return send(res, await service.startWatch(req.params.id, req.user.id));
    },

    async recordWatch(req, res) {
        return send(res, await service.recordWatch(
            req.params.id,
            req.user.id,
            req.body,
            req
        ));
    }
});

module.exports = { createEmployeeLearningController };
