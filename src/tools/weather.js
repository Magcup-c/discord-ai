export async function getWeather({ city }, { env }) {
  if (!env.WEATHER_API_KEY) {
    return { error: "天気機能が未設定です。WEATHER_API_KEYをCloudflare Secretに登録してください。" };
  }
  if (typeof city !== "string" || city.trim().length < 1 || city.length > 100) {
    throw new Error("Invalid city");
  }

  const geoUrl = new URL("https://api.openweathermap.org/geo/1.0/direct");
  geoUrl.search = new URLSearchParams({
    q: city.trim(),
    limit: "1",
    appid: env.WEATHER_API_KEY
  });
  const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(10000) });
  if (!geoResponse.ok) throw new Error("Weather geocoding request failed");
  const locations = await geoResponse.json();
  if (!locations.length) return { error: "都市が見つかりませんでした。" };

  const place = locations[0];
  const weatherUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
  weatherUrl.search = new URLSearchParams({
    lat: String(place.lat),
    lon: String(place.lon),
    units: "metric",
    lang: "ja",
    appid: env.WEATHER_API_KEY
  });
  const weatherResponse = await fetch(weatherUrl, { signal: AbortSignal.timeout(10000) });
  if (!weatherResponse.ok) throw new Error("Current weather request failed");
  const data = await weatherResponse.json();

  return {
    location: [place.name, place.state, place.country].filter(Boolean).join(", "),
    temperature_c: data.main?.temp,
    feels_like_c: data.main?.feels_like,
    description: data.weather?.[0]?.description,
    humidity_percent: data.main?.humidity,
    wind_speed_m_s: data.wind?.speed,
    observed_at: data.dt ? new Date(data.dt * 1000).toISOString() : null
  };
}
