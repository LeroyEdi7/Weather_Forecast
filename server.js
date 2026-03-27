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

// ─── Free 5-Day Forecast API ──────────────────────────────────────────────────
async function getFiveDayForecast(lat, lon) {
  const url = "https://api.openweathermap.org/data/2.5/forecast";
  const response = await axios.get(url, {
    params: {
      lat,
      lon,
      units: "metric",
      appid: process.env.OPENWEATHER_API_KEY,
    },
  });
  return response.data;
}

// ─── Parse tomorrow's data from 3-hourly forecast list ───────────────────────
function parseTomorrow(forecastData) {
  const now = new Date();

  // Build tomorrow's date string (YYYY-MM-DD)
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Filter forecast entries that fall on tomorrow
  const tomorrowEntries = forecastData.list.filter((entry) =>
    entry.dt_txt.startsWith(tomorrowStr)
  );

  if (tomorrowEntries.length === 0) {
    throw new Error("Tomorrow's forecast is not available yet. Try again shortly.");
  }

  // Aggregate data across all 3-hourly slots for tomorrow
  let totalPop = 0;
  let totalRain = 0;
  let temps = [];
  let humidities = [];
  let windSpeeds = [];

  tomorrowEntries.forEach((entry) => {
    totalPop += entry.pop || 0;
    totalRain += entry.rain?.["3h"] || 0;
    temps.push(entry.main.temp);
    humidities.push(entry.main.humidity);
    windSpeeds.push(entry.wind.speed);
  });

  const avgPop    = totalPop / tomorrowEntries.length;
  const tempMax   = Math.round(Math.max(...temps));
  const tempMin   = Math.round(Math.min(...temps));
  const humidity  = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
  const windSpeed = Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length);

  // Pick the midday slot for description & icon
  const middayEntry = tomorrowEntries[Math.floor(tomorrowEntries.length / 2)];
  const description = middayEntry.weather[0].description;
  const icon        = middayEntry.weather[0].icon;

  // Verdict based on average probability of precipitation
  let verdict, intensity;
  if (avgPop < 0.2) {
    verdict = "no_rain";  intensity = "Clear skies ahead";
  } else if (avgPop < 0.4) {
    verdict = "unlikely"; intensity = "Probably dry";
  } else if (avgPop < 0.6) {
    verdict = "possible"; intensity = "Rain possible";
  } else if (avgPop < 0.8) {
    verdict = "likely";   intensity = "Rain likely";
  } else {
    verdict = "certain";  intensity = "Definitely raining";
  }

  return {
    verdict,
    intensity,
    pop: Math.round(avgPop * 100),
    rain: totalRain.toFixed(1),
    description,
    icon,
    tempMax,
    tempMin,
    humidity,
    windSpeed,
    uvi: "N/A",
  };
}

// ─── API Route ────────────────────────────────────────────────────────────────
app.get("/api/weather", async (req, res) => {
  const { city } = req.query;

  if (!city || city.trim() === "") {
    return res.status(400).json({ error: "Please provide a city name." });
  }

  try {
    const location     = await geocodeCity(city.trim());
    const forecastData = await getFiveDayForecast(location.lat, location.lon);
    const tomorrow     = parseTomorrow(forecastData);

    res.json({
      location: {
        name:    location.name,
        country: location.country,
        state:   location.state || null,
        lat:     location.lat,
        lon:     location.lon,
      },
      tomorrow,
      timezone: forecastData.city.timezone,
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

    res.status(500).json({ error: err.message || "Failed to fetch weather data." });
  }
});

// ─── Serve frontend ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🌧  Will It Rain? server running at http://localhost:${PORT}\n`);
});
