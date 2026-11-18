const { z } = require('zod');
const { AppError } = require('../core/http');

const CACHE_TTL_MS = 15 * 60_000;
const BURSA_COORDINATES = { latitude: 40.195, longitude: 29.06 };

const weatherResponseSchema = z.object({
    current: z.object({
        time: z.string(),
        temperature_2m: z.number(),
        weather_code: z.number().int()
    }),
    daily: z.object({
        temperature_2m_max: z.array(z.number()).min(1),
        temperature_2m_min: z.array(z.number()).min(1)
    })
});

const createWeatherService = ({
    fetchImpl = global.fetch,
    cacheTtlMs = CACHE_TTL_MS,
    now = () => Date.now()
} = {}) => {
    let cachedWeather = null;

    const getTodayWeather = async () => {
        const currentTime = now();
        if (cachedWeather && cachedWeather.expiresAt > currentTime) {
            return cachedWeather.value;
        }

        const params = new URLSearchParams({
            latitude: String(BURSA_COORDINATES.latitude),
            longitude: String(BURSA_COORDINATES.longitude),
            current: 'temperature_2m,weather_code',
            daily: 'temperature_2m_max,temperature_2m_min',
            timezone: 'Europe/Istanbul',
            forecast_days: '1'
        });

        let response;
        try {
            response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, {
                signal: AbortSignal.timeout(5000)
            });
        } catch {
            throw new AppError(502, 'WEATHER_UNAVAILABLE', 'Hava durumu bilgisi alınamadı.');
        }

        if (!response.ok) {
            throw new AppError(502, 'WEATHER_UNAVAILABLE', 'Hava durumu bilgisi alınamadı.');
        }

        const parsed = weatherResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
            throw new AppError(502, 'WEATHER_INVALID_RESPONSE', 'Hava durumu servisi geçersiz yanıt verdi.');
        }

        const value = {
            city: 'Bursa',
            temperature: Math.round(parsed.data.current.temperature_2m),
            weather_code: parsed.data.current.weather_code,
            temperature_max: Math.round(parsed.data.daily.temperature_2m_max[0]),
            temperature_min: Math.round(parsed.data.daily.temperature_2m_min[0]),
            observed_at: parsed.data.current.time
        };
        cachedWeather = { value, expiresAt: currentTime + cacheTtlMs };
        return value;
    };

    return { getTodayWeather };
};

module.exports = {
    BURSA_COORDINATES,
    createWeatherService
};
