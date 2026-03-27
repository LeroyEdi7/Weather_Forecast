# 🌧 Will It Rain Tomorrow?

A Node.js + Express web app that tells you whether it will rain tomorrow in any city worldwide, powered by the **OpenWeatherMap One Call API 3.0** and **Axios**.

## Features

- 🔍 Search any city by name (geocoded automatically)
- 📊 Displays rain probability, mm of expected rainfall, temperature, humidity, wind speed, and UV index
- 🎨 Animated night-sky UI with dynamic rain drops based on forecast intensity
- ⚡ Quick-select chips for popular cities

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| HTTP Client | Axios |
| API | OpenWeatherMap Geocoding + One Call 3.0 |
| Frontend | Vanilla HTML/CSS/JS (served statically) |

---

## Setup

### 1. Clone / download the project

```bash
cd rain-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Get a free API key

1. Sign up at https://openweathermap.org/
2. Subscribe to the **One Call API 3.0** (free tier: 1,000 calls/day)
3. Copy your API key

### 4. Configure environment

Edit the `.env` file:

```env
OPENWEATHER_API_KEY=paste_your_key_here
PORT=3000
```

### 5. Run the server

```bash
npm start
```

Then open http://localhost:3000 in your browser.

For development with auto-reload:

```bash
npm run dev
```

---

## How It Works

```
User types city
      ↓
Express /api/weather route
      ↓
Axios → OpenWeatherMap Geocoding API (city → lat/lon)
      ↓
Axios → One Call API 3.0 (lat/lon → 7-day daily forecast)
      ↓
Server parses tomorrow's data (rain probability, mm, etc.)
      ↓
JSON response to browser
      ↓
Frontend renders verdict + stats
```

## API Route

`GET /api/weather?city=London`

**Response:**
```json
{
  "location": { "name": "London", "country": "GB", "lat": 51.5, "lon": -0.1 },
  "tomorrow": {
    "verdict": "likely",
    "pop": 75,
    "rain": "4.2",
    "tempMax": 14,
    "tempMin": 9,
    "humidity": 82,
    "windSpeed": 6,
    "uvi": 1
  },
  "timezone": "Europe/London"
}
```
