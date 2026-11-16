(() => {
  "use strict";

  const API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
  const POLL_MS = 5000; // API allows ~1 request/second, so this is well clear
  const TRACK_REFRESH_MS = 10 * 60 * 1000;
  const TRACK_STEP_S = 120;
  // The map shows roughly 30 minutes of orbit either side of the ISS
  const TRACK_PAST_S = 45 * 60;
  const TRACK_FUTURE_S = 60 * 60;
  // Sun altitudes for sunset, then civil, nautical and astronomical twilight.
  // Stacking a band for each fades night in gradually instead of one hard edge.
  const NIGHT_ALTITUDES = [0, -6, -12, -18];
  const DEG = Math.PI / 180;

  const map = L.map("map", {
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

  map.attributionControl.addAttribution(
    '<a href="https://www.naturalearthdata.com">Natural Earth</a>',
  );
  // Land loads asynchronously, so give it its own pane to keep it underneath
  // the night shading and track regardless of when it arrives
  map.createPane("land").style.zIndex = 350;
  const landReady = drawLand();

  const nightBands = NIGHT_ALTITUDES.map(() =>
    L.polygon([], {
      stroke: false,
      fillColor: "#000",
      fillOpacity: 0.2,
      interactive: false,
    }).addTo(map),
  );
  const pastTrack = L.polyline([], {
    color: "#fff",
    weight: 1.5,
    opacity: 0.2,
    interactive: false,
  }).addTo(map);
  const futureTrack = L.polyline([], {
    color: "#fff",
    weight: 1.5,
    opacity: 0.3,
    dashArray: "3 4",
    interactive: false,
  }).addTo(map);
  const marker = L.circleMarker([0, 0], {
    radius: 6,
    color: "#fff",
    weight: 2,
    fill: false,
    interactive: false,
  });
  let track = [];
  let current; // Latest position from the API

  pollPosition();
  refreshTrack();
  setInterval(refreshTrack, TRACK_REFRESH_MS);

  async function pollPosition() {
    try {
      const position = await getJSON(API_URL);
      // Only matters on the first poll: avoids revealing a map with no land
      await landReady;
      showPosition(position);
    } catch (error) {
      console.warn("Could not fetch ISS position", error);
    }
    // Chained rather than setInterval so slow responses never pile up
    setTimeout(pollPosition, POLL_MS);
  }

  async function refreshTrack() {
    const now = Math.floor(Date.now() / 1000);
    const timestamps = [];
    for (
      let t = now - TRACK_PAST_S;
      t <= now + TRACK_FUTURE_S;
      t += TRACK_STEP_S
    )
      timestamps.push(t);

    // The API accepts at most 10 timestamps per request
    const batches = [];
    for (let i = 0; i < timestamps.length; i += 10)
      batches.push(timestamps.slice(i, i + 10));

    try {
      const results = await Promise.all(
        batches.map((batch) =>
          getJSON(`${API_URL}/positions?timestamps=${batch.join(",")}`),
        ),
      );
      track = results.flat();
      drawTrack();
    } catch (error) {
      console.warn("Could not fetch ISS ground track", error);
    }
  }

  // Flat vector land instead of map tiles keeps the night bands easy to read.
  // Vector layers don't repeat like tiles do, so draw a copy either side too.
  async function drawLand() {
    try {
      const land = await getJSON("data/land.json");
      for (const offset of [-360, 0, 360]) {
        L.geoJSON(land, {
          pane: "land",
          className: "land",
          stroke: false,
          fillOpacity: 1,
          interactive: false,
          coordsToLatLng: ([lng, lat]) => L.latLng(lat, lng + offset),
        }).addTo(map);
      }
    } catch (error) {
      console.warn("Could not load land outlines", error);
    }
  }

  async function getJSON(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(POLL_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function showPosition(position) {
    current = position;
    const { latitude, longitude, solar_lat, solar_lon } = position;
    const here = [latitude, longitude];
    marker.setLatLng(here).addTo(map);
    map.setView(here, map.getZoom(), { animate: false });
    drawTrack();
    nightBands.forEach((band, i) =>
      band.setLatLngs(nightArea(solar_lat, solar_lon, NIGHT_ALTITUDES[i])),
    );
    // Hidden until now so it never shows the default view before the ISS
    map.getContainer().classList.add("ready");
  }

  // Called from both the position poll and the track refresh, so the path
  // appears as soon as both have arrived rather than on the next poll
  function drawTrack() {
    if (!current) return;
    const { latitude, longitude, timestamp } = current;
    const here = [latitude, longitude];
    const past = track.filter((p) => p.timestamp < timestamp).reverse();
    const future = track.filter((p) => p.timestamp > timestamp);
    pastTrack.setLatLngs([here, ...unwrapFrom(longitude, past)]);
    futureTrack.setLatLngs([here, ...unwrapFrom(longitude, future)]);
  }

  // Shift each longitude by whole turns so lines never jump across the map at ±180
  function unwrapFrom(startLng, points) {
    let prev = startLng;
    return points.map(({ latitude, longitude }) => {
      prev = longitude + 360 * Math.round((prev - longitude) / 360);
      return [latitude, prev];
    });
  }

  // Everywhere the sun is below a given altitude forms a circle on the globe,
  // centred opposite the sun. Trace that circle, then fix it up for a flat map.
  function nightArea(sunLat, sunLng, sunAltitude) {
    const centreLat = -sunLat * DEG;
    const centreLng = ((sunLng + 360) % 360) - 180;
    const radius = (90 + sunAltitude) * DEG;

    let ring = [];
    let prevLng = centreLng;
    for (let bearing = 0; bearing < 360; bearing += 2) {
      const b = bearing * DEG;
      const lat = Math.asin(
        Math.sin(centreLat) * Math.cos(radius) +
          Math.cos(centreLat) * Math.sin(radius) * Math.cos(b),
      );
      const lng =
        centreLng +
        Math.atan2(
          Math.sin(b) * Math.sin(radius) * Math.cos(centreLat),
          Math.cos(radius) - Math.sin(centreLat) * Math.sin(lat),
        ) /
          DEG;
      prevLng = lng + 360 * Math.round((prevLng - lng) / 360);
      ring.push([lat / DEG, prevLng]);
    }

    const shifted = (offset) => ring.map(([lat, lng]) => [lat, lng + offset]);
    const darkPole =
      sunLat < sunAltitude ? 90 : sunLat > -sunAltitude ? -90 : null;

    // Near the equinoxes the deeper twilight circles don't reach either pole,
    // so they're just islands. Copy them either side to cover the wrapped map.
    if (darkPole === null) return [[shifted(-360)], [ring], [shifted(360)]];

    // A circle around a pole runs once across every longitude. Lay copies end
    // to end so the shape covers any view centred on the ISS (the map shows
    // about 110° either side), then close it off along the pole.
    if (ring[ring.length - 1][1] < ring[0][1]) ring.reverse();
    const start = 360 * Math.floor((ring[0][1] + 180) / 360);
    ring = shifted(-start);
    const strip = [
      ...shifted(-720),
      ...shifted(-360),
      ...ring,
      ...shifted(360),
    ];
    return [
      ...strip,
      [darkPole, strip[strip.length - 1][1]],
      [darkPole, strip[0][1]],
    ];
  }
})();
