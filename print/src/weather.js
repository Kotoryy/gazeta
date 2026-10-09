const { fetchJson } = require("./http");

// WMO weather codes → [description, glyph]
const CODES = {
  0: ["ясно", "☀"],
  1: ["преимущественно ясно", "☀"],
  2: ["переменная облачность", "⛅"],
  3: ["пасмурно", "☁"],
  45: ["туман", "≋"],
  48: ["изморозь, туман", "≋"],
  51: ["слабая морось", "☂"],
  53: ["морось", "☂"],
  55: ["сильная морось", "☂"],
  56: ["ледяная морось", "☂"],
  57: ["ледяная морось", "☂"],
  61: ["небольшой дождь", "☂"],
  63: ["дождь", "☂"],
  65: ["сильный дождь", "☔"],
  66: ["ледяной дождь", "☔"],
  67: ["ледяной дождь", "☔"],
  71: ["небольшой снег", "❄"],
  73: ["снег", "❄"],
  75: ["сильный снег", "❄"],
  77: ["снежная крупа", "❄"],
  80: ["кратковременный дождь", "☂"],
  81: ["ливень", "☔"],
  82: ["сильный ливень", "☔"],
  85: ["снегопад", "❄"],
  86: ["сильный снегопад", "❄"],
  95: ["гроза", "⚡"],
  96: ["гроза с градом", "⚡"],
  99: ["гроза с градом", "⚡"],
};

function describe(code) {
  return CODES[code] || ["—", "·"];
}

async function loadWeather({ lat, lon }) {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure" +
    "&hourly=temperature_2m,weather_code,precipitation_probability" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
    "&wind_speed_unit=ms&timezone=Europe%2FMoscow&forecast_days=4";
  const d = await fetchJson(url, { timeout: 15000 });
  const c = d.current;
  const [text, glyph] = describe(c.weather_code);

  // Parts of today: morning 9:00, day 14:00, evening 19:00, night 23:00
  const today = d.daily.time[0];
  const parts = [["Утро", "09"], ["День", "14"], ["Вечер", "19"], ["Ночь", "23"]].map(([label, h]) => {
    const i = d.hourly.time.indexOf(`${today}T${h}:00`);
    if (i < 0) return null;
    const [t, g] = describe(d.hourly.weather_code[i]);
    return { label, temp: d.hourly.temperature_2m[i], text: t, glyph: g, rain: d.hourly.precipitation_probability[i] };
  }).filter(Boolean);

  const days = d.daily.time.map((date, i) => {
    const [t, g] = describe(d.daily.weather_code[i]);
    return {
      date,
      max: d.daily.temperature_2m_max[i],
      min: d.daily.temperature_2m_min[i],
      rain: d.daily.precipitation_probability_max[i],
      text: t,
      glyph: g,
      sunrise: d.daily.sunrise[i].slice(11),
      sunset: d.daily.sunset[i].slice(11),
    };
  });

  return {
    temp: c.temperature_2m,
    feels: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    windDir: c.wind_direction_10m,
    pressure: Math.round(c.surface_pressure * 0.750062), // hPa → mm Hg
    text,
    glyph,
    parts,
    days,
  };
}

module.exports = { loadWeather };
