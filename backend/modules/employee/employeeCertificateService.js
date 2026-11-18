const { generateCertificatePdf } = require('../../services/trainingDocumentService');
const {
    wantsJson,
    renderCertificateVerifyPage,
    loadCertificateEvidence
} = require('./employeeTrainingService');

const notFoundPage = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sertifika Bulunamadi</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;font-family:Arial,sans-serif;color:#172033;padding:24px}.card{max-width:520px;background:#fff;border:1px solid #fee2e2;border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(127,29,29,.12)}h1{color:#991b1b;margin-top:0}</style></head><body><main class="card"><h1>Sertifika bulunamadi</h1><p>Okutulan QR kod sistemde kayitli bir sertifika ile eslesmedi.</p></main></body></html>';

const createEmployeeCertificateService = (db, repository) => ({
    async verify(reference, req) {
        const certificate = await repository.findCertificate(reference);
        if (!certificate) {
            return wantsJson(req)
                ? { status: 404, type: 'json', body: { valid: false, error: 'Certificate not found' } }
                : { status: 404, type: 'html', body: notFoundPage };
        }
        return wantsJson(req)
            ? { status: 200, type: 'json', body: { valid: true, certificate } }
            : { status: 200, type: 'html', body: renderCertificateVerifyPage(certificate) };
    },

    async createPdf(assignmentId, userId, publicBaseUrl) {
        const evidence = await loadCertificateEvidence(db, assignmentId, userId);
        if (!evidence) {
            return { status: 404, type: 'json', body: { error: 'Assignment not found' } };
        }
        if (!evidence.assignment.reference_id) {
            return {
                status: 400,
                type: 'json',
                body: { error: 'Sertifika referansi olusmamis.' }
            };
        }
        const verifyUrl = `${publicBaseUrl.replace(/\/+$/, '')}/api/certificates/${encodeURIComponent(evidence.assignment.reference_id)}/verify`;
        return {
            status: 200,
            type: 'pdf',
            referenceId: evidence.assignment.reference_id,
            body: await generateCertificatePdf({ ...evidence, verifyUrl })
        };
    }
});

module.exports = { createEmployeeCertificateService };
