const junctions = {
  J1: { name: "Majestic", congestion: 32, lat: 12.9767, lng: 77.5713 },
  J2: { name: "Shivajinagar", congestion: 45, lat: 12.9856, lng: 77.6050 },
  J3: { name: "Indiranagar", congestion: 91, lat: 12.9784, lng: 77.6408 },
  J4: { name: "Domlur", congestion: 55, lat: 12.9609, lng: 77.6387 },
  J5: { name: "HAL", congestion: 76, lat: 12.9570, lng: 77.6689 },
  J6: { name: "Whitefield", congestion: 38, lat: 12.9698, lng: 77.7500 },
  J7: { name: "Richmond Town", congestion: 34, lat: 12.9647, lng: 77.6010 },
  J8: { name: "Jayanagar", congestion: 41, lat: 12.9250, lng: 77.5838 },
  J9: { name: "Koramangala", congestion: 28, lat: 12.9352, lng: 77.6245 },
  J10: { name: "MG Road", congestion: 48, lat: 12.9756, lng: 77.6066 },
  J11: { name: "HSR Layout", congestion: 62, lat: 12.9116, lng: 77.6389 },
  J12: { name: "Electronic City", congestion: 51, lat: 12.8399, lng: 77.6770 }
};

const roads = [
  { from: "J1", to: "J2", km: 3.2, minutes: 7, signals: 1, risk: 1, name: "Palace Road" },
  { from: "J2", to: "J3", km: 4.1, minutes: 9, signals: 2, risk: 2, name: "Old Airport Road" },
  { from: "J3", to: "J4", km: 3.5, minutes: 8, signals: 3, risk: 4, name: "Outer Ring Road" },
  { from: "J4", to: "J5", km: 3.4, minutes: 7, signals: 2, risk: 2, name: "HAL Airport Road" },
  { from: "J5", to: "J6", km: 8.2, minutes: 17, signals: 4, risk: 3, name: "Whitefield Main Road", shape: [[12.961, 77.688], [12.965, 77.713], [12.968, 77.735]] },
  { from: "J1", to: "J7", km: 4.7, minutes: 10, signals: 2, risk: 1, name: "Residency Road" },
  { from: "J7", to: "J8", km: 3.2, minutes: 7, signals: 1, risk: 1, name: "Richmond Road" },
  { from: "J8", to: "J9", km: 3.6, minutes: 8, signals: 1, risk: 2, name: "Jayanagar Link" },
  { from: "J9", to: "J4", km: 4.2, minutes: 9, signals: 2, risk: 1, name: "Intermediate Ring Road" },
  { from: "J7", to: "J10", km: 2.1, minutes: 5, signals: 1, risk: 1, name: "MG Road" },
  { from: "J10", to: "J4", km: 3.7, minutes: 8, signals: 2, risk: 2, name: "100 Feet Road" },
  { from: "J8", to: "J11", km: 4.9, minutes: 11, signals: 2, risk: 2, name: "HSR Link Road" },
  { from: "J11", to: "J12", km: 6.5, minutes: 14, signals: 3, risk: 2, name: "Hosur Road" },
  { from: "J12", to: "J6", km: 13.1, minutes: 26, signals: 6, risk: 4, name: "Peripheral Link" },
  { from: "J9", to: "J11", km: 4.2, minutes: 9, signals: 2, risk: 1, name: "Sarjapur Road" },
  { from: "J2", to: "J10", km: 2.8, minutes: 6, signals: 2, risk: 1, name: "Cubbon Road" },
  { from: "J10", to: "J3", km: 5.2, minutes: 11, signals: 3, risk: 2, name: "Indiranagar Link" },
  { from: "J9", to: "J5", km: 6.1, minutes: 13, signals: 3, risk: 2, name: "Domlur Flyover" },
  { from: "J5", to: "J6", km: 7.2, minutes: 15, signals: 3, risk: 3, name: "Varthur Road", shape: [[12.944, 77.684], [12.938, 77.708], [12.951, 77.731]] }
];

const vehicleFactors = {
  car: { congestion: 1, signals: 1, risk: 1, speed: 1 },
  bus: { congestion: 1.25, signals: 1.5, risk: 1, speed: 1.16 },
  bike: { congestion: 0.68, signals: 0.75, risk: 1.28, speed: 0.82 },
  ambulance: { congestion: 0.34, signals: 0.2, risk: 0.65, speed: 0.72 },
  fire: { congestion: 0.42, signals: 0.25, risk: 0.8, speed: 0.92 },
  police: { congestion: 0.32, signals: 0.18, risk: 0.7, speed: 0.68 }
};

const originSelect = document.querySelector("#origin");
const destinationSelect = document.querySelector("#destination");
const modeTabs = [...document.querySelectorAll(".mode-tab")];
const routeResult = document.querySelector("#route-result");
const routeForm = document.querySelector("#route-form");
const authorityView = document.querySelector("#authority-view");
const incidentToggle = document.querySelector("#incident-toggle");
let mode = "public";
let closureActive = true;
let alternativeVisible = false;
let riskLayerActive = false;
let cityMap = null;
let roadLayer = null;
let junctionLayer = null;
let routeLayer = null;
let vehicleLayer = null;
let incidentLayer = null;
let routeGeometryRequestId = 0;
let dashboardUsername = "Arjun";
let preferredPublicVehicle = "car";

const hospital = { name: "Manipal Hospital", lat: 12.9591, lng: 77.6472 };

function latLng(junctionId) {
  const junction = junctions[junctionId];
  return [junction.lat, junction.lng];
}

function roadCoordinates(road) {
  return [latLng(road.from), ...(road.shape || []), latLng(road.to)];
}

function initializeMap() {
  const container = document.querySelector("#city-map");
  if (!window.L) {
    console.error("Leaflet did not load. Connect to the internet to load the map.");
    container.innerHTML = '<div class="map-unavailable"><strong>Map needs an internet connection</strong><span>Reload this page while online to load the map.</span></div>';
    return;
  }

  cityMap = L.map(container, { zoomControl: false, scrollWheelZoom: true });
  cityMap.setView([12.955, 77.65], 12);
  const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>'
  }).addTo(cityMap);
  let tileErrorShown = false;
  tiles.on("tileerror", () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    console.error("Map tiles could not be loaded. Check the internet connection or tile service.");
    const notice = document.createElement("div");
    notice.className = "map-unavailable";
    notice.innerHTML = "<strong>Map tiles are unavailable</strong><span>The routing demo still works; try again later or configure another tile provider.</span>";
    container.append(notice);
  });

  roadLayer = L.layerGroup().addTo(cityMap);
  routeLayer = L.layerGroup().addTo(cityMap);
  junctionLayer = L.layerGroup().addTo(cityMap);
  vehicleLayer = L.layerGroup().addTo(cityMap);
  incidentLayer = L.layerGroup().addTo(cityMap);
  const hospitalIcon = L.divIcon({
    className: "",
    html: '<span class="hospital-marker" aria-label="Hospital">+</span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  L.marker([hospital.lat, hospital.lng], { icon: hospitalIcon })
    .bindPopup(`<strong>${hospital.name}</strong><br>Old Airport Road`)
    .addTo(cityMap);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(cityMap);
  window.setTimeout(() => cityMap.invalidateSize(), 0);
}

function fitNetwork() {
  if (!cityMap) return;
  const locations = Object.keys(junctions).map(latLng);
  cityMap.fitBounds(L.latLngBounds(locations).pad(0.12), { maxZoom: 13, animate: true });
}

function trafficColor(road) {
  if (closureActive && road.name === "Outer Ring Road") return "#df655f";
  if (riskLayerActive) {
    if (road.risk >= 4) return "#dd655e";
    if (road.risk >= 2) return "#e0a143";
    return "#36a882";
  }
  const congestion = (junctions[road.from].congestion + junctions[road.to].congestion) / 2;
  if (congestion >= 70) return "#df655f";
  if (congestion >= 45) return "#e0a143";
  return "#36a882";
}

function routeFromNodes(nodes) {
  const path = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const from = nodes[index];
    const to = nodes[index + 1];
    const road = roads.find(edge =>
      (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from));
    if (!road) return null;
    path.push({ from, to, road });
  }
  return { nodes, path };
}

function drawRouteLine(points, vehicle) {
  L.polyline(points, { color: "#fff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(routeLayer);
  L.polyline(points, {
    color: ["ambulance", "fire", "police"].includes(vehicle) ? "#d7655c" : "#4c62df",
    weight: 5,
    opacity: 0.96,
    dashArray: ["ambulance", "fire", "police"].includes(vehicle) ? "8 6" : null,
    lineCap: "round",
    lineJoin: "round"
  }).bindPopup("Graph-optimized route · simulated traffic conditions").addTo(routeLayer);
}

async function drawStreetRoute(nodes, vehicle, requestId) {
  const waypoints = nodes.map(latLng);
  const coordinates = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}`);
    const result = await response.json();
    if (result.code !== "Ok" || !result.routes?.[0]?.geometry?.coordinates?.length) {
      throw new Error(`Routing service returned ${result.code || "no route geometry"}`);
    }
    if (requestId !== routeGeometryRequestId || !cityMap) return;
    const streetPoints = result.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    routeLayer.clearLayers();
    drawRouteLine(streetPoints, vehicle);
    cityMap.fitBounds(L.latLngBounds(streetPoints).pad(0.12), { maxZoom: 15, animate: true });
  } catch (error) {
    if (requestId !== routeGeometryRequestId) return;
    console.warn("Could not load street-following route geometry; keeping the simulated graph route.", error);
  }
}

function updateMapLegend() {
  const labels = riskLayerActive ? ["Low risk", "Moderate risk", "High risk"] : ["Clear", "Moderate", "Heavy traffic"];
  document.querySelectorAll(".map-legend b").forEach((label, index) => {
    label.textContent = labels[index];
  });
}

function renderMap(route, vehicle) {
  if (!cityMap) return;
  const requestId = ++routeGeometryRequestId;
  roadLayer.clearLayers();
  routeLayer.clearLayers();
  junctionLayer.clearLayers();
  vehicleLayer.clearLayers();
  incidentLayer.clearLayers();

  roads.forEach(road => {
    const closed = closureActive && road.name === "Outer Ring Road";
    const color = trafficColor(road);
    const coordinates = roadCoordinates(road);
    const popup = `<strong>${road.name}</strong><br>${road.km} km · ${road.signals} signals<br>Congestion: ${Math.round((junctions[road.from].congestion + junctions[road.to].congestion) / 2)}%<br>Risk score: ${road.risk}${closed ? "<br><b>Closed · excluded from routing</b>" : ""}`;
    L.polyline(coordinates, {
      color: "#fff",
      weight: 5,
      opacity: 0.7,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(roadLayer);
    L.polyline(coordinates, {
      color,
      weight: closed ? 3 : 2,
      opacity: 0.82,
      dashArray: closed ? "7 7" : null,
      lineCap: "round",
      lineJoin: "round"
    }).bindPopup(popup).addTo(roadLayer);
  });

  const routeNodes = new Set(route.nodes);
  Object.entries(junctions).forEach(([id, junction]) => {
    const trafficClass = junction.congestion >= 70 ? "congestion-heavy" : junction.congestion >= 45 ? "congestion-moderate" : "congestion-clear";
    const routeClass = routeNodes.has(id) ? " route-junction" : "";
    const icon = L.divIcon({
      className: "",
      html: `<span class="junction-marker ${trafficClass}${routeClass}">${id}</span>`,
      iconSize: [19, 19],
      iconAnchor: [9.5, 9.5]
    });
    L.marker(latLng(id), { icon, keyboard: true })
      .bindPopup(`<strong>${junction.name} · ${id}</strong><br>Simulated congestion: ${junction.congestion}%<br>Signal priority available`)
      .addTo(junctionLayer);
  });

  const closure = roads.find(road => road.name === "Outer Ring Road");
  if (closureActive && closure) {
    const [start, end] = roadCoordinates(closure);
    const icon = L.divIcon({
      className: "",
      html: '<span class="incident-map-marker" aria-label="Road closure">!</span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], { icon })
      .bindPopup("<strong>Road closure</strong><br>Outer Ring Road · Indiranagar to Domlur")
      .addTo(incidentLayer);
  }

  if (route.nodes.length > 1) {
    const points = route.nodes.map(latLng);
    drawRouteLine(points, vehicle);
    drawStreetRoute(route.nodes, vehicle, requestId);
  }

  if (["ambulance", "fire", "police"].includes(vehicle)) {
    const emergencyIcon = L.divIcon({
      className: "",
      html: '<span class="emergency-marker" aria-label="Emergency vehicle">+</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(latLng(route.nodes[0]), { icon: emergencyIcon })
      .bindPopup("<strong>Emergency vehicle</strong><br>Green-corridor route active")
      .addTo(vehicleLayer);
  }

  if (route.nodes.length > 1) {
    cityMap.fitBounds(L.latLngBounds(route.nodes.map(latLng)).pad(0.3), { maxZoom: 14, animate: true });
  } else {
    cityMap.setView(latLng(route.nodes[0]), 15, { animate: true });
  }
}

function edgeWeight(road, vehicle, weather, distanceOnly = false) {
  if (distanceOnly) return road.km;
  const factors = vehicleFactors[vehicle];
  const congestion = junctions[road.from].congestion + junctions[road.to].congestion;
  const rainCost = weather === "rain" ? road.km * (road.risk > 2 ? 1.8 : 0.85) : 0;
  const congestionPriority = ["ambulance", "fire", "police"].includes(vehicle) ? 0.34 : 2.5;
  const congestionCost = congestion / 18 * factors.congestion * congestionPriority;
  const signalCost = road.signals * 1.35 * factors.signals;
  const riskCost = road.risk * 1.1 * factors.risk;
  const travelCost = road.minutes * factors.speed;
  const emergencyBenefit = ["ambulance", "fire", "police"].includes(vehicle) ? road.signals * 1.9 : 0;
  return Math.max(0.5, travelCost + congestionCost + signalCost + riskCost + rainCost - emergencyBenefit);
}

function findRoute(start, end, vehicle, weather, distanceOnly = false, excludedKey = "") {
  const distances = Object.fromEntries(Object.keys(junctions).map(id => [id, Infinity]));
  const previous = {};
  const unvisited = new Set(Object.keys(junctions));
  distances[start] = 0;

  while (unvisited.size) {
    let current = null;
    for (const node of unvisited) {
      if (current === null || distances[node] < distances[current]) current = node;
    }
    if (current === null || distances[current] === Infinity) break;
    if (current === end) break;
    unvisited.delete(current);

    for (const road of roads) {
      if (closureActive && road.name === "Outer Ring Road") continue;
      const key = [road.from, road.to].sort().join("-");
      if (key === excludedKey) continue;
      const neighbor = road.from === current ? road.to : road.to === current ? road.from : null;
      if (!neighbor || !unvisited.has(neighbor)) continue;
      const nextDistance = distances[current] + edgeWeight(road, vehicle, weather, distanceOnly);
      if (nextDistance < distances[neighbor]) {
        distances[neighbor] = nextDistance;
        previous[neighbor] = { node: current, road };
      }
    }
  }

  if (distances[end] === Infinity) return null;
  const path = [];
  let cursor = end;
  while (cursor !== start) {
    const step = previous[cursor];
    if (!step) return null;
    path.unshift({ from: step.node, to: cursor, road: step.road });
    cursor = step.node;
  }
  return { nodes: [start, ...path.map(step => step.to)], path, score: distances[end] };
}

function summarizeRoute(route, vehicle, weather) {
  const totals = route.path.reduce((sum, step) => {
    const congestion = (junctions[step.from].congestion + junctions[step.to].congestion) / 200;
    sum.km += step.road.km;
    sum.minutes += step.road.minutes * vehicleFactors[vehicle].speed * (1 + congestion * 0.42) + step.road.signals * 0.42 * vehicleFactors[vehicle].signals;
    sum.signals += step.road.signals;
    sum.risk += step.road.risk;
    return sum;
  }, { km: 0, minutes: 0, signals: 0, risk: 0 });
  if (weather === "rain") totals.minutes *= 1.16;
  if (["ambulance", "fire", "police"].includes(vehicle)) totals.minutes *= 0.77;
  return { ...totals, minutes: Math.max(1, Math.round(totals.minutes)), km: totals.km.toFixed(1) };
}

function renderRoute() {
  const start = originSelect.value;
  const end = destinationSelect.value;
  const vehicle = document.querySelector("#vehicle-type").value;
  const weather = document.querySelector("#weather").value;
  const route = findRoute(start, end, vehicle, weather);
  const shortest = findRoute(start, end, vehicle, weather, true);
  if (!route) {
    routeResult.hidden = true;
    window.alert("No open route connects these junctions. Clear an incident or choose another destination.");
    return;
  }
  routeResult.hidden = false;
  const summary = summarizeRoute(route, vehicle, weather);
  renderMap(route, vehicle);
  const shortestSummary = shortest ? summarizeRoute(shortest, vehicle, weather) : summary;
  document.querySelector("#route-eta").textContent = summary.minutes;
  document.querySelector("#route-distance").textContent = summary.km;
  document.querySelector("#route-signals").textContent = summary.signals;
  document.querySelector("#route-origin-label").textContent = junctions[start].name;
  document.querySelector("#route-destination-label").textContent = junctions[end].name;
  document.querySelector("#route-path").innerHTML = route.nodes.map((node, index) =>
    `${index ? "<i></i>" : ""}<span>${node}</span>`).join("");
  const diff = Math.max(1, Math.abs(shortestSummary.minutes - summary.minutes));
  const explanation = closureActive && route.path.some(step => step.road.name === "Outer Ring Road")
    ? `Shortest route passes a closed road; recalculated through ${route.nodes.slice(1, -1).join(" · ")} instead.`
    : summary.minutes <= shortestSummary.minutes
      ? `Chosen for lower travel time, considering congestion, signals and road risk.`
      : `Chosen route has a lower combined traffic and safety cost than the distance-only path.`;
  document.querySelector("#route-insight-text").textContent = explanation;
  document.querySelector("#route-insight-text").insertAdjacentHTML("beforeend",
    ` <strong>${summary.risk} risk points</strong> on this route.`);
  document.querySelector("#priority-junctions").textContent = route.nodes.slice(1, -1).join(" · ") || "Direct approach";
  document.querySelector("#emergency-priority").hidden = !["ambulance", "fire", "police"].includes(vehicle);
  document.querySelector("#incident-value").textContent = closureActive ? "01" : "00";
  document.querySelector(".incident-count").textContent = closureActive ? "1" : "0";
  document.body.classList.toggle("closure-hidden", !closureActive);
  document.body.classList.toggle("emergency-mode", mode === "emergency");
  document.body.classList.toggle("alternative-active", alternativeVisible);
  const progress = Math.max(48, Math.min(95, Math.round(100 * (route.path.length / 7))));
  document.querySelector("#route-line").style.width = `${progress}%`;

  const alternatives = route.path.length > 1
    ? findRoute(start, end, vehicle, weather, false, [route.path[0].from, route.path[0].to].sort().join("-"))
    : null;
  const alternativeButton = document.querySelector("#alternative-button");
  const resultLabel = document.querySelector(".result-header > span:first-child");
  resultLabel.textContent = "RECOMMENDED ROUTE";
  alternativeButton.textContent = alternatives ? "Compare alternative route" : "No alternative route available";
  alternativeButton.insertAdjacentHTML("beforeend", "<span>↗</span>");
  alternativeButton.disabled = !alternatives;
  alternativeButton.dataset.route = alternatives ? alternatives.nodes.join(",") : "";
  const alternativeSummary = alternatives ? summarizeRoute(alternatives, vehicle, weather) : null;
  alternativeButton.dataset.eta = alternativeSummary ? alternativeSummary.minutes : "";
  alternativeButton.dataset.km = alternativeSummary ? alternativeSummary.km : "";
  alternativeButton.dataset.signals = alternativeSummary ? alternativeSummary.signals : "";
  alternativeButton.dataset.risk = alternativeSummary ? alternativeSummary.risk : "";
  alternativeVisible = false;
  document.body.classList.remove("alternative-active");
}

modeTabs.forEach(tab => tab.addEventListener("click", () => {
  const nextMode = tab.dataset.mode;
  const vehicleSelect = document.querySelector("#vehicle-type");
  const publicVehicleOptions = document.querySelector("#public-vehicle-options");
  const emergencyVehicleOptions = document.querySelector("#emergency-vehicle-options");
  if (mode === "public" && ["car", "bus", "bike"].includes(vehicleSelect.value)) {
    preferredPublicVehicle = vehicleSelect.value;
  }
  mode = nextMode;
  modeTabs.forEach(item => {
    item.classList.toggle("active", item === tab);
    item.setAttribute("aria-selected", String(item === tab));
  });
  publicVehicleOptions.disabled = mode === "emergency";
  emergencyVehicleOptions.disabled = mode === "public";
  if (mode === "public" && !["car", "bus", "bike"].includes(vehicleSelect.value)) {
    vehicleSelect.value = preferredPublicVehicle;
  } else if (mode === "emergency" && !["ambulance", "fire", "police"].includes(vehicleSelect.value)) {
    vehicleSelect.value = "ambulance";
  }
  const authority = mode === "authority";
  routeForm.hidden = authority;
  authorityView.hidden = !authority;
  routeResult.hidden = authority;
  document.querySelector("#emergency-priority").hidden = mode !== "emergency";
  if (!authority) renderRoute();
}));

document.querySelector("#optimize-button").addEventListener("click", renderRoute);
originSelect.addEventListener("change", renderRoute);
destinationSelect.addEventListener("change", renderRoute);
document.querySelector("#vehicle-type").addEventListener("change", event => {
  if (mode === "public" && ["car", "bus", "bike"].includes(event.currentTarget.value)) {
    preferredPublicVehicle = event.currentTarget.value;
  }
  renderRoute();
});
document.querySelector("#weather").addEventListener("change", renderRoute);
incidentToggle.addEventListener("click", () => {
  closureActive = !closureActive;
  renderRoute();
});
document.querySelector("#swap-route").addEventListener("click", () => {
  const origin = originSelect.value;
  originSelect.value = destinationSelect.value;
  destinationSelect.value = origin;
  renderRoute();
});
document.querySelector("#alternative-button").addEventListener("click", event => {
  const button = event.currentTarget;
  if (!button.dataset.route) return;
  alternativeVisible = !alternativeVisible;
  document.body.classList.toggle("alternative-active", alternativeVisible);
  if (alternativeVisible) {
    const nodes = button.dataset.route.split(",");
    const alternativeRoute = routeFromNodes(nodes);
    if (alternativeRoute) renderMap(alternativeRoute, document.querySelector("#vehicle-type").value);
      document.querySelector(".result-header > span:first-child").textContent = "ALTERNATIVE ROUTE";
      document.querySelector("#route-path").innerHTML = nodes.map((node, index) =>
        `${index ? "<i></i>" : ""}<span>${node}</span>`).join("");
      document.querySelector("#route-eta").textContent = button.dataset.eta;
      document.querySelector("#route-distance").textContent = button.dataset.km;
      document.querySelector("#route-signals").textContent = button.dataset.signals;
      document.querySelector("#route-insight-text").textContent = `Alternative path avoids ${nodes[1]} and uses ${button.dataset.risk} risk points.`;
      button.firstChild.textContent = "Back to recommended route";
    } else {
      renderRoute();
  }
});
document.querySelector("#risk-layer-button").addEventListener("click", event => {
  riskLayerActive = event.currentTarget.classList.toggle("active");
  document.querySelector("#traffic-layer-button").classList.toggle("active", !riskLayerActive);
  updateMapLegend();
  renderRoute();
});
document.querySelector("#traffic-layer-button").addEventListener("click", () => {
  riskLayerActive = false;
  document.querySelector("#traffic-layer-button").classList.add("active");
  document.querySelector("#risk-layer-button").classList.remove("active");
  updateMapLegend();
  renderRoute();
});
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
  const view = button.dataset.view;
  const tab = view === "signals" || view === "incidents" ? "authority" : "public";
  document.querySelector(`.mode-tab[data-mode="${tab}"]`).click();
}));
document.querySelector("#refresh-button").addEventListener("click", event => {
  const button = event.currentTarget;
  button.classList.add("refreshing");
  window.setTimeout(() => button.classList.remove("refreshing"), 550);
  renderRoute();
});
document.querySelector("#map-zoom-in").addEventListener("click", () => cityMap?.zoomIn());
document.querySelector("#map-zoom-out").addEventListener("click", () => cityMap?.zoomOut());
document.querySelector("#fit-map").addEventListener("click", fitNetwork);
document.querySelector("#logout-button").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error(`Sign-out failed (HTTP ${response.status}).`);
    window.location.replace("/auth.html");
  } catch (error) {
    console.error("Could not sign out:", error);
    window.alert("Could not sign out. Check the connection and try again.");
    button.disabled = false;
  }
});

function updateDashboardClock() {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.querySelector("#current-date").textContent = date.toUpperCase();
  document.querySelector("#current-time").textContent = time;
  document.querySelector("#greeting").firstChild.textContent = `${greeting}, ${dashboardUsername} `;
}

async function startDashboard() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) {
      window.location.replace("/auth.html");
      return;
    }
    const { user } = await response.json();
    const username = user.username;
    dashboardUsername = username;
    const initials = username.slice(0, 2).toUpperCase();
    document.querySelector("#profile-username").textContent = username;
    document.querySelector("#profile-avatar").textContent = initials;
    document.querySelector("#topbar-avatar").textContent = initials;
    document.body.classList.remove("auth-pending");
    document.body.classList.add("authenticated");
    updateDashboardClock();
    window.setInterval(updateDashboardClock, 60_000);
    initializeMap();
    renderRoute();
  } catch (error) {
    console.error("Could not verify the Flowstate session:", error);
    window.location.replace("/auth.html");
  }
}

startDashboard();
