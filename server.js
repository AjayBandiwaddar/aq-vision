require('dotenv').config();
const express = require('express');
const path = require('path');

// Robust fetch support
let fetchFn = global.fetch;
if (!fetchFn) {
  const nodeFetch = require('node-fetch');
  fetchFn = nodeFetch.default || nodeFetch;
}
const fetch = fetchFn;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API Keys from Environment Variables ---
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const AIRNOW_API_KEY      = process.env.AIRNOW_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENAI_API_KEY      = process.env.OPENAI_API_KEY;

const OPENAQ_BASE = "https://api.openaq.org/v3/measurements";

// --- API Routes ---

// Proxy for Google Maps JS to hide the API key from the client
app.get('/maps', async (req, res) => {
  try {
    const libs = 'drawing,geometry';
    // FIXED: Enclosed the URL string in backticks (`)
    const mapsUrl = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=${encodeURIComponent(libs)}&v=weekly`;
    const r = await fetch(mapsUrl);
    if (!r.ok) return res.status(500).send('Failed to load Google Maps');
    const text = await r.text();
    res.set('Content-Type', 'application/javascript');
    res.send(text);
  } catch (err) {
    res.status(500).send('Error loading Google Maps');
  }
});

// Fetch aggregated PM2.5 from OpenAQ ground sensors
app.get('/api/openaq', async (req, res) => {
  try {
    const { lat, lon, radius = 5000, days = 1 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat,lon required' });

    const dateTo = new Date().toISOString();
    const dateFrom = new Date(Date.now() - (parseInt(days) * 24 * 3600 * 1000)).toISOString();

    const url = new URL(OPENAQ_BASE);
    url.searchParams.set('parameter', 'pm25');
    // FIXED: Enclosed the coordinate string in backticks (`)
    url.searchParams.set('coordinates', `${lat},${lon}`);
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('date_from', dateFrom);
    url.searchParams.set('date_to', dateTo);
    url.searchParams.set('limit', '1000');
    url.searchParams.set('sort', 'desc');

    const r = await fetch(url.toString(), { headers: { 'accept': 'application/json' }});
    if (!r.ok) return res.status(r.status).json({ error: 'OpenAQ fetch failed' });
    
    const j = await r.json();
    const vals = (j.results || []).map(o => ({ value: o.value, date: o.date?.local, unit: o.unit, location: o.location }));
    const numeric = vals.map(v => Number(v.value)).filter(Number.isFinite);
    const mean = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null;
    
    return res.json({ mean, values: numeric, raw: vals, meta: j.meta || null });
  } catch (err) {
    console.error('openaq error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Fetch current weather conditions from OpenWeather
app.get('/api/openweather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat,lon required' });
    // FIXED: Enclosed the URL string in backticks (`)
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: 'OpenWeather fetch failed' });
    return res.json(await r.json());
  } catch (err) {
    console.error('openweather error', err);
    return res.status(500).json({ error: err.message });
  }
});

// Fetch air pollution data from OpenWeather (more global coverage than AirNow)
app.get('/api/ow-air', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) return res.status(400).json({ error: 'lat,lon required' });
        // FIXED: Enclosed the URL string in backticks (`)
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
        const r = await fetch(url);
        if (!r.ok) return res.status(r.status).json({ error: 'OpenWeather Air Pollution fetch failed' });
        return res.json(await r.json());
    } catch (err) {
        console.error('ow-air error', err);
        return res.status(500).json({ error: err.message });
    }
});

// Proxy to OpenAI Chat Completions API
app.post('/api/openai', async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body || {};
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: prompt });

    const payload = { model: 'gpt-3.5-turbo', messages: messages };
    
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // FIXED: Enclosed the Authorization value in backticks (`)
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errorBody = await r.json();
      console.error('❌ OpenAI API Error:', errorBody);
      return res.status(r.status).json({ error: 'OpenAI API error', details: errorBody });
    }
    
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content || '';
    return res.json({ text });
  } catch (err) {
    console.error('❌ OpenAI proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  // FIXED: Enclosed the log message string in backticks (`)
  console.log(`🌐 AQ-Vision server running at http://localhost:${PORT}`);
  console.log('='.repeat(60) + '\n');
});