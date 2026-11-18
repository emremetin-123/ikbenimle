const test = require('node:test');
const assert = require('node:assert/strict');
const { createWeatherService } = require('../services/weatherService');

test('Bursa hava durumu yanitini normalize eder ve onbellekten sunar', async () => {
    let requestCount = 0;
    const service = createWeatherService({
        fetchImpl: async () => {
            requestCount += 1;
            return {
                ok: true,
                json: async () => ({
                    current: {
                        time: '2026-07-30T12:00',
                        temperature_2m: 29.6,
                        weather_code: 1
                    },
                    daily: {
                        temperature_2m_max: [30.4],
                        temperature_2m_min: [15.7]
                    }
                })
            };
        },
        now: () => 1_000
    });

    const first = await service.getTodayWeather();
    const second = await service.getTodayWeather();

    assert.deepEqual(first, {
        city: 'Bursa',
        temperature: 30,
        weather_code: 1,
        temperature_max: 30,
        temperature_min: 16,
        observed_at: '2026-07-30T12:00'
    });
    assert.deepEqual(second, first);
    assert.equal(requestCount, 1);
});
