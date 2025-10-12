(function() {
  // --- STATE MANAGEMENT ---
  let map;
  let polygons = [],
    polygonFeatures = [];
  let cityCenter = { lat: 12.9716, lng: 77.5946 }; // Default to Bengaluru
  let isAiRequestPending = false;

  // --- UTILITIES & CALCULATORS (For Demo Map) ---
  const aqiColors = {
    good: '#4ade80',
    moderate: '#facc15',
    unhealthy_sensitive: '#fb923c',
    unhealthy: '#f87171',
    very_unhealthy: '#c084fc',
    hazardous: '#a16207'
  };

  function getColor(aqi) {
    if (aqi > 300) return aqiColors.hazardous;
    if (aqi > 200) return aqiColors.very_unhealthy;
    if (aqi > 150) return aqiColors.unhealthy;
    if (aqi > 100) return aqiColors.unhealthy_sensitive;
    if (aqi > 50) return aqiColors.moderate;
    return aqiColors.good;
  }

  // --- DEMO MAP & DATA FUNCTIONS ---
  function clearPolygons() {
    polygons.forEach(p => p.setMap(null));
    polygons = [];
    polygonFeatures = [];
  }

  function addPolygonsToMap(geojson) {
    clearPolygons();
    geojson.features.forEach(f => {
      const coords = f.geometry.coordinates[0].map(pt => ({ lat: pt[1], lng: pt[0] }));
      const color = getColor(f.properties.aqi);
      const poly = new google.maps.Polygon({
        paths: coords,
        strokeColor: '#ffffff',
        strokeWeight: 0.4,
        fillColor: color,
        fillOpacity: 0.85,
        map
      });
      polygons.push(poly);
      polygonFeatures.push(f);
    });
  }

  function generateMockGeoData(center) {
    const features = [];
    const numPoints = 20;
    const boxSize = 0.4;
    const zones = ['Industrial Area', 'City Center', 'Residential North', 'Greenbelt South', 'Tech Park East'];
    for (let i = 0; i < numPoints; i++) {
      for (let j = 0; j < numPoints; j++) {
        const lng = center.lng - (boxSize / 2) + (j * boxSize / numPoints);
        const lat = center.lat - (boxSize / 2) + (i * boxSize / numPoints);
        const baseAqi = 50 + (Math.sin(i * 0.5) * 20) + (Math.cos(j * 0.3) * 30) + (Math.random() * 20);
        const aqi = Math.round(Math.max(10, Math.min(350, baseAqi + (lng - center.lng) * 200)));
        features.push({
          type: 'Feature',
          properties: { aqi, zone: zones[(i * numPoints + j) % zones.length] },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [lng, lat],
                [lng + boxSize / numPoints, lat],
                [lng + boxSize / numPoints, lat + boxSize / numPoints],
                [lng, lat + boxSize / numPoints],
                [lng, lat]
              ]
            ]
          }
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }

  function updateMap(center) {
    if (!map) return;
    map.setCenter(center);
    const geojson = generateMockGeoData(center);
    addPolygonsToMap(geojson);
    const pm25Mock = geojson.features[Math.floor(geojson.features.length / 2)].properties.aqi * 0.35;
    document.getElementById('multi-std').innerHTML = `
      <div class="std-card">
        <div class="text-sm text-slate-600">Reference PM2.5 <small class="text-slate-400">mock</small></div>
        <div class="mt-2 text-2xl font-bold text-sky-700">${pm25Mock.toFixed(1)} µg/m³</div>
      </div>
      <div class="std-card">
        <div class="text-sm text-slate-600">US-EPA AQI <small class="text-slate-400">mock</small></div>
        <div class="mt-2 text-2xl font-bold text-sky-700">${(pm25Mock * 2.5).toFixed(0)}</div>
      </div>`;
  }

  // --- LIVE AI INSIGHTS FUNCTION ---
  async function getAiInsight(type) {
    if (isAiRequestPending) return;
    isAiRequestPending = true;
    const out = document.getElementById('insights-output');
    out.innerHTML = '<div class="flex justify-center items-center h-full"><div class="spinner"></div></div>';

    try {
      // Step 1: Fetch live data from the backend.
      const [openAqRes, owAirRes, weatherRes] = await Promise.all([
        fetch(`/api/openaq?lat=${cityCenter.lat}&lon=${cityCenter.lng}`),
        fetch(`/api/ow-air?lat=${cityCenter.lat}&lon=${cityCenter.lng}`),
        fetch(`/api/openweather?lat=${cityCenter.lat}&lon=${cityCenter.lng}`)
      ]);

      if (!owAirRes.ok || !weatherRes.ok) throw new Error("Could not fetch essential live data from servers.");

      const openAqData = openAqRes.ok ? await openAqRes.json() : { mean: null };
      const owAirData = await owAirRes.json();
      const weatherData = await weatherRes.json();

      if (!owAirData.list ?.[0] || !weatherData.name) {
        throw new Error("Live data is incomplete for this location.");
      }

      // Step 2: Engineer the prompt with the live data.
      const mainPollutants = owAirData.list[0].components;
      const dataForPrompt = {
        location: { name: weatherData.name, country: weatherData.sys.country },
        ground_sensor_pm25: openAqData.mean ? `${openAqData.mean.toFixed(2)} µg/m³` : 'N/A',
        main_pollutants_micrograms_per_cubic_meter: {
          pm2_5: mainPollutants.pm2_5.toFixed(2),
          pm10: mainPollutants.pm10.toFixed(2),
          no2: mainPollutants.no2.toFixed(2),
          o3: mainPollutants.o3.toFixed(2),
          so2: mainPollutants.so2.toFixed(2)
        },
        weather: {
          condition: weatherData.weather[0].description,
          temp: `${weatherData.main.temp}°C`,
          humidity: `${weatherData.main.humidity}%`,
          wind: `${weatherData.wind.speed} m/s from ${weatherData.wind.deg}°`
        }
      };

      const prompts = {
        summary: "Provide a concise 1-2 sentence summary of the current air quality based on this data.",
        health: "As a public health advisor, provide 2-3 bullet points with actionable health recommendations for the general public and sensitive groups.",
        action: "Provide a simple, 3-point personal action plan someone can take today to reduce their exposure to this pollution.",
        cigarette: "Based on the ground sensor PM2.5 value, calculate the cigarette equivalent. Explain the result simply, stating it's a rule-of-thumb comparison where ~22 µg/m³ is like smoking 1 cigarette per day. If sensor data is N/A, say so.",
        school: "Act as a school nurse. Based on the data, provide a clear 'Yes', 'Caution', or 'No' for outdoor playtime for school children. Briefly explain why in simple terms.",
        mask: "Provide a specific mask recommendation (e.g., 'No mask needed', 'Consider an N95/FFP2 mask') and give advice on outdoor activity levels based on the PM2.5 value."
      };

      const finalPrompt = `Context: You are an AI air quality expert. Analyze the following real-time data and respond to the user's request. Be clear and helpful. Do not repeat the input data in your response. Live Data: ${JSON.stringify(dataForPrompt)} User Request: ${prompts[type]}`;

      // Step 3: Call the correct /api/openai backend endpoint.
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt })
      });

      if (!response.ok) {
        const errText = await response.text();
        try {
          const errJson = JSON.parse(errText);
          throw new Error(errJson.details?.error?.message || errJson.error || `AI server error: ${response.statusText}`);
        } catch {
          throw new Error(`AI server error: ${response.statusText}. Response: ${errText}`);
        }
      }
      const result = await response.json();
      let htmlResult = result.text.replace(/\n/g, '<br>').replace(/(\* |- )/g, '<br>• ');
      out.innerHTML = `<div><h4 class="text-lg font-semibold text-slate-800 mb-2">AI Insight: ${type.charAt(0).toUpperCase() + type.slice(1)}</h4><div class="prose prose-sm max-w-none text-slate-700">${htmlResult}</div></div>`;

    } catch (err) {
      out.innerHTML = `<div class="text-red-500">Error generating AI insight: ${err.message}</div>`;
    } finally {
      isAiRequestPending = false;
    }
  }

  // --- INITIALIZATION & EVENT LISTENERS ---
  function initCharts() {
    new Chart(document.getElementById('validationChart').getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Predicted vs Actual AQI',
          data: Array.from({ length: 50 }, () => {
            const a = Math.random() * 200 + 20;
            return { x: a, y: a + (Math.random() - 0.5) * 30 };
          }),
          backgroundColor: 'rgba(56,189,248,0.6)'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
    new Chart(document.getElementById('zoneChart').getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Industrial', 'City Center', 'Residential', 'Greenbelt', 'Tech Park'],
        datasets: [{
          label: 'Average AQI',
          data: [185, 152, 95, 65, 120],
          backgroundColor: ['#f87171', '#f87171', '#facc15', '#facc15', '#fb923c']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });
  }

  async function geocodeCity(cityName) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}`);
      if (!res.ok) return null;
      const results = await res.json();
      return results[0] ? { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) } : null;
    } catch {
      return null;
    }
  }

  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      center: cityCenter,
      zoom: 11,
      mapTypeId: 'roadmap',
      gestureHandling: 'greedy'
    });
    updateMap(cityCenter);
  }

  function waitForGoogleAndInit() {
    if (window.google && window.google.maps) {
      initMap();
      initCharts();
    } else {
      setTimeout(waitForGoogleAndInit, 100);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    waitForGoogleAndInit();

    document.getElementById('city-search-btn').addEventListener('click', async () => {
      const cityName = document.getElementById('city-search').value.trim();
      if (!cityName) return;
      const coords = await geocodeCity(cityName);
      if (coords) {
        cityCenter = coords;
        document.getElementById('lat-input').value = cityCenter.lat.toFixed(4);
        document.getElementById('lon-input').value = cityCenter.lng.toFixed(4);
        updateMap(cityCenter);
      } else {
        alert('City not found.');
      }
    });

    document.getElementById('latlon-go').addEventListener('click', () => {
      const lat = parseFloat(document.getElementById('lat-input').value);
      const lon = parseFloat(document.getElementById('lon-input').value);
      if (isFinite(lat) && isFinite(lon)) {
        cityCenter = { lat, lng: lon };
        updateMap(cityCenter);
      } else {
        alert('Please enter valid latitude and longitude.');
      }
    });

    document.getElementById('use-location').addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          cityCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          document.getElementById('lat-input').value = cityCenter.lat.toFixed(4);
          document.getElementById('lon-input').value = cityCenter.lng.toFixed(4);
          updateMap(cityCenter);
        }, () => alert('Could not get your location.'));
      } else {
        alert('Geolocation is not supported by your browser.');
      }
    });

    document.querySelectorAll('.ai-btn').forEach(btn => {
      btn.addEventListener('click', () => getAiInsight(btn.dataset.insight));
    });
    
    // Remove the old demo-specific button event listeners
    // They are now handled by the .ai-btn listener above
  });
})();