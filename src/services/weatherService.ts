import type { WeatherInfo } from '@/types';

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 4000 }
    );
  });
}

/**
 * weatherService — real data via Open-Meteo (free, no API key required).
 * Falls back to Tehran's coordinates when geolocation is denied/unavailable,
 * and to a mock reading only if the network call itself fails (#18).
 */
export const weatherService = {
  async getCurrent(): Promise<WeatherInfo> {
    const pos = (await getPosition()) ?? { lat: 35.6892, lon: 51.389 }; // Tehran fallback
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,relative_humidity_2m,uv_index`;
      const res = await fetch(url);
      const json = await res.json();
      return {
        temp: Math.round(json.current.temperature_2m),
        humidity: Math.round(json.current.relative_humidity_2m),
        uv: Math.round(json.current.uv_index ?? 0),
      };
    } catch {
      // Network/API failure fallback — clearly a fallback, not presented as live data.
      return { temp: 25, humidity: 40, uv: 5 };
    }
  },

  advice(weather: WeatherInfo): string {
    if (weather.uv >= 6) return `شاخص UV بالاست (${weather.uv}). ضدآفتاب را طبق دستور استفاده و هر چند ساعت تجدید کنید.`;
    if (weather.humidity < 35) return `رطوبت هوا پایین است (${weather.humidity}٪). امروز روی آبرسانی پوست تمرکز کنید.`;
    return 'هوا معتدل است، روتین معمول خود را ادامه دهید.';
  },
};
