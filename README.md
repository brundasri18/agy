# BigQuery Release Notes Tracker 📊📢

A sleek, modern web application built with Python Flask, vanilla HTML5, CSS3, and JavaScript that aggregates, parses, and formats the official Google Cloud BigQuery release notes feed. It allows you to search and filter updates, group select them, and compose/share updates directly on Twitter (X).

---

## ✨ Features

- **🚀 Live Feed Aggregation**: Fetches the official [BigQuery Release Notes XML Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml).
- **📦 Smart Local Caching**: Implements a server-side cache (`cache.json` with a 1-hour TTL) to prevent rate-limiting and maximize loading speeds.
- **🔄 On-Demand Refresh**: Includes a beautiful refresh button with a loading spinner that pulls fresh data instantly from Google Cloud.
- **🔍 Granular Parsing**: Extracts individual updates by parsing standard `<h3>` markup headers (such as *Feature*, *Issue*, *Change*, *Deprecated*) within each day's entry.
- **🏷️ Interactive Filter Chips**: Filter updates instantly by type with glowing custom badges.
- **⚡ Real-Time Search**: Query release updates instantly by keyword, category, or date.
- **🐦 Simulated X (Twitter) Composer**: 
  - Select one or multiple updates to trigger a slide-up drawer.
  - Opens a custom Tweet Composer modal.
  - Automatically formats the text, includes links, checks character count limits (280 chars) using an SVG progress circle, copies to clipboard, and generates X Web Intents.

---

## 🛠️ Technology Stack

- **Backend**: Python, Flask, requests
- **Frontend**: HTML5 (Semantic), CSS3 (Custom Variables, Animations, Glassmorphism), JavaScript (Vanilla ES6)
- **Icons**: FontAwesome v6.4.0
- **Typography**: Google Fonts (Inter & Outfit)

---

## 📂 Project Structure

```
agy-cli-projects/
│
├── app.py                # Flask server, parsing logic, and caching
├── requirements.txt      # Python dependencies
├── cache.json            # Local feed cache (git-ignored)
├── .gitignore            # Excludes build, cache, and system files
├── README.md             # Project documentation (this file)
│
├── templates/
│   └── index.html        # App layout structure
│
└── static/
    ├── css/
    │   └── style.css     # CSS variables, glassmorphic styling, and animations
    └── js/
        └── app.js        # Selection state, search, and twitter integrations
```

---

## ⚙️ Quick Start

### Prerequisites
Make sure you have **Python 3.x** installed.

### 1. Clone & Set Up Directory
Open your terminal inside the project directory.

### 2. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 3. Run the Flask Server
Start the local server:
```bash
python app.py
```

### 4. Open in Browser
Open your browser and navigate to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🎨 Style & Aesthetics
- **Dark Mode**: Utilizes deep slate/charcoal backgrounds (`#080c14`) and glows for a premium feel.
- **Responsive Layout**: Designed to look stunning on both widescreen desktop screens and mobile screens.
- **Micro-Animations**: Uses fading card entries (`fadeInUp`), spinning sync loaders, and sliding action drawers.
