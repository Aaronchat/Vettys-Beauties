// Location catalog helpers and property-scoped state.
let activePropertyContextId = null;

function locationById(id) {
  return LOCATIONS.find(location => location.id === id);
}

function regionById(id) {
  return LOCATION_REGIONS.find(region => region.id === id);
}

function ownedLocationIds() {
  return state.ownedLocationIds.filter(id => !!state.properties[id] && !!locationById(id));
}

function isLocationOwned(id) {
  return ownedLocationIds().includes(id);
}

function currentLocation() {
  return locationById(state.currentLocationId) || locationById("belton");
}

function propertyState(locationId = null) {
  const id = locationId || activePropertyContextId || state.currentLocationId;
  return state.properties[id];
}

function withPropertyContext(locationId, callback) {
  const previous = activePropertyContextId;
  activePropertyContextId = locationId;
  try {
    return callback(propertyState(locationId));
  } finally {
    activePropertyContextId = previous;
  }
}

function newPropertyState(locationId) {
  const isBelton = locationId === "belton";
  return {
    locationId,
    buildingLevel: 1,
    facilities: Object.fromEntries(FACILITY_NAMES.map(name => [name, 1])),
    pendingFacilities: {},
    pendingBuildingLevel: null,
    managerId: "ted",
    performers: isBelton ? [contractFor(byId("zella"))] : [],
    formerPerformers: [],
    transactions: [],
    activePromotions: {},
    clubHistory: [],
    notifications: [],
    lastLedger: null,
    selectedPerformerId: isBelton ? "zella" : null,
    selectedSource: "active",
    profileOpen: false,
  };
}

function normalizePropertyState(raw, locationId) {
  const fresh = newPropertyState(locationId);
  if (!raw || typeof raw !== "object") return fresh;
  const managerId = propertyManagerById(raw.managerId) ? raw.managerId : "ted";
  return {
    ...fresh,
    ...raw,
    locationId,
    facilities: { ...fresh.facilities, ...(raw.facilities || {}) },
    pendingFacilities: raw.pendingFacilities && typeof raw.pendingFacilities === "object" ? raw.pendingFacilities : {},
    pendingBuildingLevel: raw.pendingBuildingLevel || null,
    managerId,
    performers: (raw.performers || fresh.performers).map(normalizePerformer),
    formerPerformers: (raw.formerPerformers || []).map(normalizePerformer),
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    activePromotions: normalizeActivePromotions(raw.activePromotions),
    clubHistory: Array.isArray(raw.clubHistory) ? raw.clubHistory : [],
    notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
    lastLedger: raw.lastLedger && raw.lastLedger.version === "v1.6" ? raw.lastLedger : null,
    selectedPerformerId: raw.selectedPerformerId || fresh.selectedPerformerId,
    selectedSource: raw.selectedSource || "active",
    profileOpen: !!raw.profileOpen,
  };
}

function performerAssignedAnywhere(id) {
  return Object.values(state.properties).some(property =>
    property.performers.some(p => p.id === id) || property.formerPerformers.some(p => p.id === id)
  );
}

function selectLocation(locationId) {
  const location = locationById(locationId);
  if (!location || !isLocationOwned(locationId) || state.currentLocationId === locationId) return;
  state.currentLocationId = locationId;
  saveState();
  setMessage(`Now viewing ${location.displayName}.`);
  render();
}

function purchaseLocation(locationId) {
  const location = locationById(locationId);
  if (!location || isLocationOwned(locationId) || !location.purchasePrice) return;
  if (!requireCash(location.purchasePrice, `${location.displayName} property purchase`)) return;
  const purchaseProperty = propertyState();
  state.cash -= location.purchasePrice;
  purchaseProperty.transactions.push({ label: `${location.displayName} Property Purchase`, amount: location.purchasePrice, week: state.week });
  purchaseProperty.clubHistory.unshift({ week: state.week, text: `${location.displayName} property purchased for ${money(location.purchasePrice)}.` });
  purchaseProperty.clubHistory = purchaseProperty.clubHistory.slice(0, 120);
  state.properties[locationId] = newPropertyState(locationId);
  state.ownedLocationIds.push(locationId);
  state.properties[locationId].clubHistory.unshift({ week: state.week, text: `${location.displayName} joined the Vetty's Beauties empire.` });
  commit(`${location.displayName} purchased for ${money(location.purchasePrice)}. It is ready to be managed separately.`);
}
