# Vector Map Creator

**Interactive web app for creating beautiful vector maps for presentations and visualizations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![D3.js](https://img.shields.io/badge/D3.js-v7-orange.svg)](https://d3js.org/)

---

## Features

- Interactive map creation with real-time preview
- Four map projections: Natural Earth, Mercator, Robinson, and Globe
- Customizable styling including fill colors, border colors, and stroke widths
- Region filtering by continent and sub-region
- Smooth zoom and pan navigation
- Export to SVG and PNG formats
- Zero build tools required - runs directly in the browser

## Quick Start

```bash
git clone https://github.com/stepankaiser/vector-map-creator.git
cd vector-map-creator
```

Open `index.html` in your browser. That's it - no install, no build step, no dependencies to manage.

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 | Structure and styling |
| ES6+ JavaScript | Application logic (vanilla, no frameworks) |
| D3.js v7 | Map rendering and interaction |
| D3 Geo Projection v4 | Extended projection support |
| TopoJSON v3 | Efficient geographic data format |
| Natural Earth | World map data (loaded via CDN) |

## Supported Projections

- **Natural Earth** - a pseudocylindrical projection with a natural, balanced look
- **Mercator** - the classic conformal projection familiar from web maps
- **Robinson** - a compromise projection widely used in atlases
- **Globe** - an orthographic projection showing the Earth as a sphere

## Export Options

- **SVG** - scalable vector output, ideal for print materials, presentations, and further editing in tools like Illustrator or Inkscape
- **PNG** - raster output suitable for embedding in web pages, documents, and social media

## Browser Compatibility

Vector Map Creator works in all modern browsers that support ES6+ and SVG:

- Chrome 61+
- Firefox 60+
- Safari 12+
- Edge 79+

## License

This project is licensed under the [MIT License](LICENSE).
