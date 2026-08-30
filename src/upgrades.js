// Facility and building upgrade rules.
function facilityUpgradeCost(level) {
  return 1000 * Math.pow(2, level - 1);
}

function buildingUpgradeCost(level) {
  return 2000 * Math.pow(2, level - 1);
}

function canUpgradeBuilding() {
  if (propertyState().buildingLevel >= 5 || propertyState().pendingBuildingLevel) return false;
  return Object.values(propertyState().facilities).every(level => level > propertyState().buildingLevel);
}

function upgradeFacility(name) {
  const level = propertyState().facilities[name];
  const cost = facilityUpgradeCost(level);
  if (level >= 5 || level > propertyState().buildingLevel || propertyState().pendingFacilities[name]) return;
  if (!requireCash(cost, `${name} upgrade`)) return;
  state.cash -= cost;
  propertyState().pendingFacilities[name] = level + 1;
  recordTransaction(`${name} Upgrade`, cost);
  addHistory(`${name} upgrade purchased for ${money(cost)}. Level ${level + 1} effects begin next week.`);
  commit(`${name} upgrade purchased. Level ${level + 1} effects begin next week.`);
}

function upgradeBuilding() {
  if (!canUpgradeBuilding()) return;
  const cost = buildingUpgradeCost(propertyState().buildingLevel);
  if (!requireCash(cost, "building upgrade")) return;
  state.cash -= cost;
  propertyState().pendingBuildingLevel = propertyState().buildingLevel + 1;
  recordTransaction("Building Upgrade", cost);
  addHistory(`Building Level ${propertyState().pendingBuildingLevel} upgrade purchased for ${money(cost)}. Effects begin next week.`);
  commit(`Building Level ${propertyState().pendingBuildingLevel} purchased. Capacity, expenses, and artwork update next week.`);
}

function completePendingUpgrades() {
  const notices = [];
  Object.entries(propertyState().pendingFacilities).forEach(([name, target]) => {
    propertyState().facilities[name] = target;
    notices.push(`${name} reached Level ${target}.`);
    addHistory(`${name} reached Level ${target}.`);
  });
  propertyState().pendingFacilities = {};
  if (propertyState().pendingBuildingLevel) {
    propertyState().buildingLevel = propertyState().pendingBuildingLevel;
    notices.push(`Building reached Level ${propertyState().buildingLevel}.`);
    addHistory(`Building reached Level ${propertyState().buildingLevel}.`);
    propertyState().pendingBuildingLevel = null;
  }
  return notices;
}
