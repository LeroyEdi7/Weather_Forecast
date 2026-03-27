require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── Geocoding: city name → lat/lon ───────────────────────────────────────────
async function geocodeCity(city) {
  const url = "https://api.openweathermap.org/geo/1.0/direct";
  const response = await axios.get(url, {
    params: {
      q: city,
      limit: 1,
      appid: process.env.OPENWEATHER_API_KEY,
    },
  });

  if (!response.data || response.data.length === 0) {
    throw new Error(`City "${city}" not found.`);
  }

  const { lat, lon, name, country, state } = response.data[0];
  return { lat, lon, name, country, state };
}

// ─── One Call API 3.0: daily forecast ────────────────────────────────────────
async function getDailyForecast(lat, lon) {
  const url = "https://api.openweathermap.org/data/3.0/onecall";
  const response = await axios.get(url, {
    params: {
      lat,
      lon,
      exclude: "current,minutely,hourly,alerts",
      units: "metric",
      appid: process.env.OPENWEATHER_API_KEY,
    },
  });
  return response.data;
}

// ─── Parse tomorrow's rain data ───────────────────────────────────────────────
function parseTomorrow(forecastData) {
  const tomorrow = forecastData.daily[1]; // index 0 = today, 1 = tomorrow

  const rain = tomorrow.rain || 0; // mm
  const pop = tomorrow.pop || 0; // probability of precipitation (0–1)
  const weather = tomorrow.weather[0];
  const tempMax = Math.round(tomorrow.temp.max);
  const tempMin = Math.round(tomorrow.temp.min);
  const humidity = tomorrow.humidity;
  const windSpeed = Math.round(tomorrow.wind_speed);
  const uvi = Math.round(tomorrow.uvi);

  // Determine rain verdict
  let verdict, intensity;
  if (pop < 0.2) {
    verdict = "no_rain";
    intensity = "Clear skies ahead";
  } else if (pop < 0.4) {
    verdict = "unlikely";
    intensity = "Probably dry";
  } else if (pop < 0.6) {
    verdict = "possible";
    intensity = "Rain possible";
  } else if (pop < 0.8) {
    verdict = "likely";
    intensity = "Rain likely";
  } else {
    verdict = "certain";
    intensity = "Definitely raining";
  }

  return {
    verdict,
    intensity,
    pop: Math.round(pop * 100),
    rain: rain.toFixed(1),
    description: weather.description,
    icon: weather.icon,
    tempMax,
    tempMin,
    humidity,
    windSpeed,
    uvi,
    sunrise: tomorrow.sunrise,
    sunset: tomorrow.sunset,
  };
}

// ─── API Route ────────────────────────────────────────────────────────────────
app.get("/api/weather", async (req, res) => {
  const { city } = req.query;

  if (!city || city.trim() === "") {
    return res.status(400).json({ error: "Please provide a city name." });
  }

  try {
    const location = await geocodeCity(city.trim());
    const forecastData = await getDailyForecast(location.lat, location.lon);
    const tomorrow = parseTomorrow(forecastData);

    res.json({
      location: {
        name: location.name,
        country: location.country,
        state: location.state || null,
        lat: location.lat,
        lon: location.lon,
      },
      tomorrow,
      timezone: forecastData.timezone,
    });
  } catch (err) {
    console.error("Weather API error:", err.message);

    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    if (err.response?.status === 401) {
      return res.status(401).json({ error: "Invalid API key. Check your .env file." });
    }
    if (err.response?.status === 429) {
      return res.status(429).json({ error: "API rate limit reached. Try again later." });
    }

    res.status(500).json({ error: "Failed to fetch weather data. Please try again." });
  }
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🌧  Will It Rain? server running at http://localhost:${PORT}\n`);
});
