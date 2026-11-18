const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../core/http');
const { createWeatherService } = require('../services/weatherService');

module.exports = () => {
    const router = express.Router();
    const weatherService = createWeatherService();

    router.use(authenticateToken);
    router.get('/today', asyncHandler(async (_req, res) => {
        res.json(await weatherService.getTodayWeather());
    }));

    return router;
};
