// Universal empire state, save migration, history, and selected property profile state.
function newState() {
  return {
    week: 1,
    cash: 10000,
    ownedLocationIds: ["belton"],
    currentLocationId: "belton",
    properties: { belton: newPropertyState("belton") },
  };
}

function normalizePerformer(p) {
  const base = byId(p.id) || { id: p.id, name: p.name || "Unknown", concept: p.concept || "Former performer" };
  return contractFor(base, {
    ...p,
    history: Array.isArray(p.history) ? p.history : [],
    trainingCompleted: p.trainingCompleted || 0,
    weeklyCost: performerBasePay({ ...base, ...p }),
    renewalOffer: null,
    renewalAttempted: !!p.renewalAttempted,
    renewalDeclined: !!p.renewalDeclined,
    rehireOffer: p.rehireOffer || null,
    exitReason: p.exitReason || null,
    lastWeeklyCost: p.lastWeeklyCost || p.weeklyCost || 200,
    returnWeeks: Math.max(0, p.returnWeeks || 0),
    injuryWeeks: Math.max(0, p.injuryWeeks || 0),
    renewalWarningShown: !!p.renewalWarningShown,
    resetOnReturn: !!p.resetOnReturn,
    skipReturnTick: !!p.skipReturnTick,
  });
}

function legacyBeltonProperty(raw) {
  return normalizePropertyState({
    buildingLevel: raw.buildingLevel,
    facilities: raw.facilities,
    pendingFacilities: raw.pendingFacilities,
    pendingBuildingLevel: raw.pendingBuildingLevel,
    managerId: raw.propertyManagers && raw.propertyManagers.belton ? raw.propertyManagers.belton : "ted",
    performers: raw.performers,
    formerPerformers: raw.formerPerformers,
    transactions: raw.transactions,
    activePromotions: raw.activePromotions,
    clubHistory: raw.clubHistory,
    notifications: raw.notifications,
    lastLedger: raw.lastLedger,
    selectedPerformerId: raw.selectedPerformerId,
    selectedSource: raw.selectedSource,
    profileOpen: raw.profileOpen,
  }, "belton");
}

function migrate(raw) {
  const fresh = newState();
  if (!raw || typeof raw !== "object") return fresh;

  if (!raw.properties || typeof raw.properties !== "object") {
    return {
      week: Number.isFinite(raw.week) ? raw.week : fresh.week,
      cash: Number.isFinite(raw.cash) ? raw.cash : fresh.cash,
      ownedLocationIds: ["belton"],
      currentLocationId: "belton",
      properties: { belton: legacyBeltonProperty(raw) },
    };
  }

  const propertyIds = [...new Set(["belton", ...(raw.ownedLocationIds || []), ...Object.keys(raw.properties)])]
    .filter(id => !!locationById(id));
  const properties = {};
  propertyIds.forEach(id => {
    if (id === "belton" || raw.properties[id]) properties[id] = normalizePropertyState(raw.properties[id], id);
  });
  const owned = propertyIds.filter(id => !!properties[id]);
  const current = owned.includes(raw.currentLocationId) ? raw.currentLocationId : "belton";
  return {
    week: Number.isFinite(raw.week) ? raw.week : fresh.week,
    cash: Number.isFinite(raw.cash) ? raw.cash : fresh.cash,
    ownedLocationIds: owned,
    currentLocationId: current,
    properties,
  };
}

function loadState() {
  try {
    return migrate(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return newState();
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function commit(message) {
  saveState();
  setMessage(message);
  render();
}

function canPay(amount) {
  return state.cash >= amount;
}

function requireCash(amount, label) {
  if (canPay(amount)) return true;
  setMessage(`Insufficient cash for ${label}: need ${money(amount)}, have ${money(state.cash)}.`);
  render();
  return false;
}

function recordTransaction(label, amount) {
  propertyState().transactions.push({ label, amount, week: state.week });
}

function addHistory(text, week = state.week) {
  const property = propertyState();
  property.clubHistory.unshift({ week, text });
  property.clubHistory = property.clubHistory.slice(0, 120);
}

function chooseProfile(id, source = "active") {
  const property = propertyState();
  property.selectedPerformerId = id;
  property.selectedSource = source;
  property.profileOpen = true;
  saveState();
  render();
}

function closeProfile() {
  propertyState().profileOpen = false;
  saveState();
  render();
}

function selectedPerformer() {
  const property = propertyState();
  if (property.selectedSource === "former") return property.formerPerformers.find(p => p.id === property.selectedPerformerId);
  if (property.selectedSource === "market") return contractFor(byId(property.selectedPerformerId));
  return property.performers.find(p => p.id === property.selectedPerformerId) || property.performers[0];
}

function queueNotification(notification) {
  propertyState().notifications.push({
    type: "info",
    eyebrow: "CLUB NOTICE",
    title: "Vetty's Beauties",
    message: "",
    week: state.week,
    ...notification,
  });
}

function queueDueContractWarnings() {
  propertyState().performers.forEach(p => {
    if (p.weeksRemaining !== 1 || p.renewalWarningShown) return;
    p.renewalWarningShown = true;
    queueNotification({
      type: "contract",
      eyebrow: "CONTRACT WARNING",
      title: `${p.name}: 1 Week Remaining`,
      message: p.renewalDeclined
        ? `${p.name} rejected her renewal offer. Her contract expires when you advance the week, and the existing contract rules do not allow another offer.`
        : `${p.name}'s contract expires when you advance the week. Make a renewal offer now or she will leave the club.`,
      performerId: p.id,
    });
  });
}

function dismissNotification() {
  propertyState().notifications.shift();
  saveState();
  render();
}

function openNotificationPerformer(id) {
  propertyState().notifications.shift();
  const source = propertyState().performers.some(p => p.id === id) ? "active" : "former";
  chooseProfile(id, source);
}

function newGame() {
  if (!confirm("Start a New Game? This will permanently erase your current Vetty's Beauties save.")) return;
  state = newState();
  saveState();
  setMessage("New game started. Vetty's Beauties is back to Week 1 in Belton.");
  render();
}

function setMessage(text) {
  document.querySelector("#message").textContent = text;
}

let state = loadState();
