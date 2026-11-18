const createEmployeeCertificateController = service => ({
    async verify(req, res) {
        try {
            const outcome = await service.verify(req.params.reference, req);
            if (outcome.type === 'json') return res.status(outcome.status).json(outcome.body);
            res.status(outcome.status).setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(outcome.body);
        } catch (error) {
            return res.status(500).json({
                error: process.env.NODE_ENV === 'production'
                    ? 'INTERNAL_SERVER_ERROR'
                    : error.message
            });
        }
    },

    async download(req, res) {
        try {
            const publicBaseUrl = process.env.PUBLIC_APP_URL
                || `${req.protocol}://${req.get('host')}`;
            const outcome = await service.createPdf(
                req.params.id,
                req.user.id,
                publicBaseUrl
            );
            if (outcome.type === 'json') {
                return res.status(outcome.status).json(outcome.body);
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="Sertifika_${outcome.referenceId}.pdf"`
            );
            return res.send(outcome.body);
        } catch (error) {
            return res.status(500).json({
                error: process.env.NODE_ENV === 'production'
                    ? 'INTERNAL_SERVER_ERROR'
                    : error.message
            });
        }
    }
});

module.exports = { createEmployeeCertificateController };
