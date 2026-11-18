import { useQuery } from '@tanstack/react-query';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import { queryKeys } from '../../queryClient';
import { api } from '../../services/api';
import type { TodayWeather } from '../../types';

const getCondition = (code: number) => {
  if (code === 0) return { label: 'Açık', icon: Sun };
  if (code <= 2) return { label: 'Parçalı bulutlu', icon: CloudSun };
  if (code === 3) return { label: 'Kapalı', icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Sisli', icon: CloudFog };
  if (code >= 71 && code <= 86) return { label: 'Karlı', icon: CloudSnow };
  if (code >= 51 && code <= 82) return { label: 'Yağışlı', icon: CloudRain };
  if (code >= 95) return { label: 'Gök gürültülü', icon: CloudLightning };
  return { label: 'Hava durumu', icon: CloudSun };
};

export function WeatherStrip() {
  const weatherQuery = useQuery({
    queryKey: queryKeys.homeWeather,
    queryFn: () => api.get<TodayWeather>('/api/weather/today'),
    staleTime: 15 * 60_000,
  });
  const weather = weatherQuery.data;
  const condition = getCondition(weather?.weather_code ?? 0);
  const WeatherIcon = condition.icon;

  return (
    <section className="home-weather-strip" aria-label="Bursa günlük hava durumu">
      <div className="home-weather-primary">
        <strong className="home-weather-city">Bursa</strong>
        {weatherQuery.isError ? (
          <span className="home-weather-unavailable">Hava durumu alınamadı</span>
        ) : (
          <>
            <WeatherIcon
              className="home-weather-icon"
              size={24}
              aria-label={weather ? condition.label : 'Yükleniyor'}
            />
            <strong className="home-weather-temperature">
              {weather ? `${weather.temperature}°` : '--°'}
            </strong>
            <span className="home-weather-range">
              {weather ? condition.label : 'Hava durumu yükleniyor…'}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
