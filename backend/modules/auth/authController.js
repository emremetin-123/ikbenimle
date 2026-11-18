function createAuthController(service) {
    return {
        async login(req, res) {
            res.json(await service.login({
                employeeId: req.body.employee_id,
                password: req.body.password,
                req,
                res
            }));
        },
        async logout(req, res) {
            await service.logout(req, res);
            res.json({ message: 'Oturum başarıyla kapatıldı.' });
        },
        async logoutAll(req, res) {
            await service.logoutAll(req, res);
            res.json({ message: 'Tüm oturumlar kapatıldı.' });
        },
        session(req, res) {
            res.json(service.getSession(req.user, req.authSession));
        }
    };
}

module.exports = { createAuthController };
