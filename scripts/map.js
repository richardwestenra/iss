(() => {
  'use strict';

  const POSITION_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
  const POLL_MS = 5000; // API allows ~1 request/second, so this is well clear

  const map = L.map('map', {
    center: [0, 0],
    zoom: 1,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    touchZoom: false,
  });
  map.attributionControl.setPrefix(false);

  // NASA imagery needs no API key, unlike most free tile providers these days
  L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', {
    attribution: 'Imagery: <a href="https://www.earthdata.nasa.gov/gibs">NASA GIBS</a>',
    maxNativeZoom: 8,
  }).addTo(map);

  const night = L.terminator({ stroke: false, fillColor: '#000', fillOpacity: 0.35 }).addTo(map);
  let marker;

  updatePosition();

  async function updatePosition() {
    try {
      const response = await fetch(POSITION_URL, { signal: AbortSignal.timeout(POLL_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { latitude, longitude } = await response.json();
      showPosition([latitude, longitude]);
    } catch (error) {
      console.warn('Could not fetch ISS position', error);
    }
    // Chained rather than setInterval so slow responses never pile up
    setTimeout(updatePosition, POLL_MS);
  }

  function showPosition(latlng) {
    if (!marker) {
      marker = L.circleMarker(latlng, { radius: 6, color: '#fff', weight: 2, fill: false, interactive: false }).addTo(map);
    }
    marker.setLatLng(latlng);
    map.setView(latlng, map.getZoom(), { animate: false });
    night.setTime();
  }
})();
