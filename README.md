# AQ-Vision: AI-Enhanced Air Quality Monitoring

A modern web application that provides high-resolution air quality estimates with AI-powered insights, combining real-time sensor data from multiple sources and interactive mapping capabilities.

## 🌟 Features

- **Interactive Map**: Click or draw polygons on Google Maps to get detailed air quality insights
- **Real-time Data**: Aggregates data from OpenAQ, OpenWeather, and AirNow APIs
- **AI Insights**: Powered by OpenAI GPT-3.5-turbo for actionable recommendations
- **Data Visualization**: Charts comparing model predictions vs. ground truth
- **PDF Reports**: Generate downloadable reports comparing PM2.5 data against WHO guidelines
- **Responsive Design**: Built with Tailwind CSS for mobile and desktop compatibility

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- API Keys from:
  - [OpenWeather](https://openweathermap.org/api)
  - [Google Maps](https://developers.google.com/maps)
  - [OpenAI](https://platform.openai.com/)
  - [AirNow](https://www.airnowapi.org/) (optional, US-only)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aq-vision
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your API keys:
```env
OPENWEATHER_API_KEY=your_openweather_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENAI_API_KEY=your_openai_api_key
AIRNOW_API_KEY=your_airnow_api_key
PORT=3000
```

4. Start the development server:
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## 📁 Project Structure

```
aq-vision/
├── server.js              # Express.js backend server
├── package.json           # Node.js dependencies and scripts
├── public/
│   ├── index.html         # Main HTML page
│   └── script.js          # Frontend JavaScript logic
└── README.md              # This file
```

## 🛠️ API Endpoints

### Backend APIs

- `GET /` - Serves the main application
- `GET /maps` - Proxies Google Maps JavaScript API
- `GET /api/openaq` - Fetches aggregated PM2.5 data from OpenAQ
- `GET /api/openweather` - Retrieves current weather conditions
- `GET /api/ow-air` - Gets air pollution data from OpenWeather
- `POST /api/openai` - Generates AI insights using OpenAI

### Frontend Features

- **City Search**: Geocode city names to coordinates
- **Manual Coordinates**: Input latitude/longitude directly
- **Geolocation**: Use browser's location API
- **Pollutant Selection**: Choose between AQI, PM2.5, NO₂, O₃
- **Date Range**: Adjust time period for data analysis
- **AI Insights**: Generate summaries, health recommendations, action plans, etc.

## 🔧 Configuration

The application uses environment variables for API keys. Create a `.env` file in the project root:

```env
# Required
OPENWEATHER_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Optional
AIRNOW_API_KEY=your_key_here
PORT=3000
```

## 📊 Data Sources

- **Air Quality**: OpenAQ Platform (global sensors), AirNow (US sensors)
- **Weather**: OpenWeather API
- **Mapping**: Google Maps Platform
- **AI Analysis**: OpenAI GPT-3.5-turbo

## 🏗️ Architecture

### Backend (Node.js/Express)
- RESTful API design
- API key proxying for security
- Error handling and logging
- CORS enabled for frontend communication

### Frontend (Vanilla JS)
- Modular JavaScript with IIFE pattern
- Chart.js for data visualization
- jsPDF and html2canvas for PDF generation
- Responsive UI with Tailwind CSS

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

## ⚠️ Disclaimer

This application is for demonstration purposes only. Data and recommendations are illustrative and should not be used for critical decision-making. Always consult official air quality monitoring services for accurate information.

## 🙏 Acknowledgments

- OpenAQ for global air quality sensor data
- OpenWeather for meteorological data
- Google Maps Platform for mapping services
- OpenAI for AI-powered insights
- Chart.js, Tailwind CSS, and other open-source libraries
