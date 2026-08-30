// Start the game after every rule and screen file has loaded.
// v1.9 gameplay extension: new performers, manager automation, and Austin pricing.

[
  { id: "bella", name: "Bella", concept: "Nun" },
  { id: "harley", name: "Harley", concept: "Harley Quinn-inspired" },
  { id: "scarlett", name: "Scarlett", concept: "Devil" },
].forEach(performer => {
  if (!PERFORMER_POOL.some(existing => existing.id === performer.id)) PERFORMER_POOL.push(performer);
});

Object.assign(ASSETS.performers, {
  bella: "assets/performers/bella.jpeg",
  harley: "assets/performers/harley.jpeg",
  scarlett: "assets/performers/scarlett.jpeg",
});

function locationPriceMultiplier(locationId = null) {
  const id = locationId || (propertyState() && propertyState().locationId) || state.currentLocationId;
  return id === "austin" ? 2 : 1;
}

function locationPrice(baseAmount, locationId = null) {
  return Math.round(baseAmount * locationPriceMultiplier(locationId));
}

function currentSigningFee() {
  return locationPrice(SIGNING_FEE);
}

function currentTrainingCost() {
  return locationPrice(TRAINING_COST);
}

// Austin pays twice the Belton rate for performers. Revenue itself is unchanged.
const beltonPerformerBasePay = performerBasePay;
performerBasePay = function localizedPerformerBasePay(performer) {
  return locationPrice(beltonPerformerBasePay(performer));
};

const beltonPerformerPay = performerPay;
performerPay = function localizedPerformerPay(performer) {
  return locationPrice(beltonPerformerPay(performer));
};

promotionCost = function localizedPromotionCost() {
  return locationPrice(1000 * propertyState().buildingLevel);
};

facilityUpgradeCost = function localizedFacilityUpgradeCost(level) {
  return locationPrice(1000 * Math.pow(2, level - 1));
};

buildingUpgradeCost = function localizedBuildingUpgradeCost(level) {
  return locationPrice(2000 * Math.pow(2, level - 1));
};

const beltonManagerRenewalOffer = managerRenewalOffer;
managerRenewalOffer = function localizedManagerRenewalOffer(manager) {
  const offer = beltonManagerRenewalOffer(manager);
  return offer ? { ...offer, bonus: locationPrice(offer.bonus) } : offer;
};

expenses = function localizedExpenses(sheriffOverride = null, manager = activePropertyManager()) {
  const performerCosts = workingPerformers().reduce((sum, performer) => sum + performerPay(performer), 0);
  const baseBuilding = BUILDING_EXPENSES[propertyState().buildingLevel];
  const building = {
    tax: locationPrice(baseBuilding.tax),
    operations: locationPrice(baseBuilding.operations),
    advertising: locationPrice(baseBuilding.advertising),
    sheriff: locationPrice(baseBuilding.sheriff),
  };
  return {
    performers: performerCosts,
    manager: locationPrice(manager.salary),
    ...building,
    sheriff: sheriffOverride === null ? building.sheriff : sheriffOverride,
  };
};

hire = function localizedHire(id, kind = "fresh") {
  if (!hasCapacity()) {
    setMessage(`Club at capacity: ${rosterCount()}/${CAPACITY[propertyState().buildingLevel]} performer slots filled.`);
    render();
    return;
  }
  const signingFee = currentSigningFee();
  if (!requireCash(signingFee, "signing fee")) return;
  const active = propertyState().performers.some(performer => performer.id === id && performer.weeksRemaining > 0);
  if (active) return;
  const former = propertyState().formerPerformers.find(performer => performer.id === id);
  if (former && (former.returnWeeks || 0) > 0) {
    setMessage(`${former.name} is not currently available. Possible return in ${former.returnWeeks} week${former.returnWeeks === 1 ? "" : "s"}.`);
    render();
    return;
  }
  const freshReturn = kind === "fresh-return" || (former && former.resetOnReturn);
  const base = freshReturn ? byId(id) : former || contractFor(byId(id));
  if (!base) return;
  const item = { kind: freshReturn ? "fresh-return" : former ? "former" : kind, performer: base };
  const weeklyCost = hireRate(item);
  state.cash -= signingFee;
  recordTransaction(`${base.name} Signing Fee`, signingFee);
  propertyState().performers.push(contractFor(base, {
    weeklyCost,
    weeksRemaining: 26,
    trainingWeeks: 0,
    injuryWeeks: 0,
    renewalOffer: null,
    renewalAttempted: false,
    renewalDeclined: false,
    renewalWarningShown: false,
    rehireOffer: null,
    returnWeeks: 0,
    exitReason: null,
    resetOnReturn: false,
    history: freshReturn ? [] : base.history || [],
  }));
  propertyState().formerPerformers = propertyState().formerPerformers.filter(performer => performer.id !== id);
  propertyState().selectedPerformerId = id;
  propertyState().selectedSource = "active";
  propertyState().profileOpen = true;
  addHistory(`${base.name} signed a fresh 26-week contract. Signing fee: ${money(signingFee)}.`);
  commit(`${base.name} signed a fresh 26-week contract. Signing fee paid: ${money(signingFee)}.`);
};

train = function localizedTrain(id) {
  const performer = propertyState().performers.find(existing => existing.id === id);
  if (!performer || performer.trainingWeeks) return;
  if (performer.rank === "A") {
    setMessage(`${performer.name} is already Max Rank.`);
    render();
    return;
  }
  if ((performer.injuryWeeks || 0) > 0) {
    setMessage(`${performer.name} cannot train while injured.`);
    render();
    return;
  }
  const trainingCost = currentTrainingCost();
  if (!requireCash(trainingCost, "training")) return;
  state.cash -= trainingCost;
  recordTransaction(`${performer.name} Training`, trainingCost);
  performer.trainingWeeks = 4;
  addHistory(`${performer.name} started training. Cost: ${money(trainingCost)}.`);
  commit(`${performer.name} left for four weeks of dance and specialization training. Her contract clock keeps running.`);
};

renew = function localizedRenew(id, bonus) {
  const performer = propertyState().performers.find(existing => existing.id === id);
  if (!performer || performer.weeksRemaining <= 0) return;
  const baseOffer = RENEWAL_OFFERS.find(offer => offer.bonus === bonus || locationPrice(offer.bonus) === bonus);
  if (!baseOffer) return;
  if (performer.weeksRemaining !== 1) {
    setMessage(`${performer.name}'s renewal is locked until exactly 1 week remains.`);
    render();
    return;
  }
  if (performer.renewalAttempted || performer.renewalDeclined) {
    setMessage(`${performer.name} already received her one renewal offer for this contract.`);
    render();
    return;
  }
  const offer = { ...baseOffer, bonus: locationPrice(baseOffer.bonus) };
  if (!requireCash(offer.bonus, "renewal signing bonus")) return;
  const result = attemptRenewal(performer, offer);
  commit(result.message);
};

const originalMoveFormer = moveFormer;
moveFormer = function managerAwareMoveFormer(performer, reason, overrides = {}) {
  const needsReplacement = /death/i.test(reason) || (reason === "expired" && !!performer.renewalDeclined);
  originalMoveFormer(performer, reason, overrides);
  if (needsReplacement) {
    const property = propertyState();
    property.managerReplacementRequests = (property.managerReplacementRequests || 0) + 1;
  }
};

function managerAutoSignReplacement() {
  const property = propertyState();
  if ((property.managerReplacementRequests || 0) <= 0 || !hasCapacity()) return null;
  const manager = activePropertyManager();
  const signingFee = currentSigningFee();
  if (!canPay(signingFee)) {
    return `${manager.name} is waiting to replace an open performer slot but needs ${money(signingFee)} for the signing fee.`;
  }
  const available = marketPerformers();
  if (!available.length) return `${manager.name} could not find an available performer to fill the open slot.`;

  const item = randomItem(available);
  const candidate = item.performer;
  const freshRules = item.kind === "fresh" || item.kind === "fresh-return" || candidate.resetOnReturn;
  const base = freshRules ? byId(candidate.id) : candidate;
  if (!base) return null;
  const weeklyCost = hireRate(item);

  state.cash -= signingFee;
  recordTransaction(`${base.name} Signing Fee — ${manager.name}`, signingFee);
  property.performers.push(contractFor(base, {
    weeklyCost,
    weeksRemaining: 26,
    trainingWeeks: 0,
    injuryWeeks: 0,
    renewalOffer: null,
    renewalAttempted: false,
    renewalDeclined: false,
    renewalWarningShown: false,
    rehireOffer: null,
    returnWeeks: 0,
    exitReason: null,
    resetOnReturn: false,
    history: freshRules ? [] : base.history || [],
  }));
  property.formerPerformers = property.formerPerformers.filter(performer => performer.id !== base.id);
  property.managerReplacementRequests--;
  const message = `${manager.name} automatically signed ${base.name} to fill the open performer slot. Signing fee: ${money(signingFee)}.`;
  addHistory(message);
  return message;
}

function managerAutoFillVacancies() {
  const notices = [];
  let guard = 0;
  while ((propertyState().managerReplacementRequests || 0) > 0 && hasCapacity() && guard < 20) {
    const before = propertyState().managerReplacementRequests;
    const notice = managerAutoSignReplacement();
    if (notice) notices.push(notice);
    guard++;
    if (propertyState().managerReplacementRequests === before) break;
  }
  return notices;
}

function managerAutoTraining() {
  const manager = activePropertyManager();
  if (manager.id !== "myrtle" && manager.id !== "gertrude") return [];
  const property = propertyState();
  const notices = [];
  const trainingCost = currentTrainingCost();
  const trainingLimit = Math.floor(property.performers.length / 2);
  const currentlyTraining = property.performers.filter(performer => performer.trainingWeeks > 0).length;
  const openTrainingSlots = Math.max(0, trainingLimit - currentlyTraining);
  const eligible = property.performers.filter(performer =>
    performer.rank !== "A" &&
    performer.trainingWeeks === 0 &&
    (performer.injuryWeeks || 0) <= 0 &&
    performer.weeksRemaining > 4
  ).slice(0, openTrainingSlots);

  for (const performer of eligible) {
    if (!canPay(trainingCost)) {
      notices.push(`${manager.name} wants to keep training the roster but needs ${money(trainingCost)} for the next session.`);
      break;
    }
    state.cash -= trainingCost;
    recordTransaction(`${performer.name} Training — ${manager.name}`, trainingCost);
    performer.trainingWeeks = 4;
    addHistory(`${manager.name} automatically sent ${performer.name} to training. Cost: ${money(trainingCost)}.`);
    notices.push(`${manager.name} automatically sent ${performer.name} to training toward Rank A.`);
  }
  return notices;
}

const originalAttemptManagerRenewals = attemptManagerRenewals;
attemptManagerRenewals = function expandedManagerAutomation(locationId = null) {
  const notices = originalAttemptManagerRenewals(locationId) || [];
  notices.push(...managerAutoFillVacancies());
  notices.push(...managerAutoTraining());
  return notices;
};

function applyLocalizedPriceDisplay() {
  const signingFee = currentSigningFee();
  const trainingCost = currentTrainingCost();
  const full = !hasCapacity();

  const marketStatus = document.querySelector("#market-status");
  if (marketStatus) {
    marketStatus.textContent = full
      ? `Club at capacity: ${rosterCount()}/${CAPACITY[propertyState().buildingLevel]} performer slots filled.`
      : `Open slots: ${CAPACITY[propertyState().buildingLevel] - rosterCount()}. Signing fee: ${money(signingFee)}.`;
  }

  document.querySelectorAll("#recruitment .performer.recruit button").forEach(button => {
    button.disabled = full || !canPay(signingFee);
    button.textContent = full ? "Club at capacity" : !canPay(signingFee) ? "Insufficient cash" : `Hire - ${money(signingFee)}`;
  });

  const performer = selectedPerformer();
  if (performer) {
    const employed = propertyState().performers.some(existing => existing.id === performer.id);
    const trainButton = document.querySelector("#profile-train");
    if (trainButton && employed) {
      const disabled = performer.trainingWeeks || (performer.injuryWeeks || 0) > 0 || performer.weeksRemaining <= 4 || performer.rank === "A" || !canPay(trainingCost);
      trainButton.disabled = disabled;
      trainButton.textContent = performer.rank === "A"
        ? "Max Rank"
        : (performer.injuryWeeks || 0) > 0
          ? "Cannot train while injured"
          : canPay(trainingCost)
            ? `Train - ${money(trainingCost)}`
            : "Insufficient cash for training";
    }

    const hireButton = document.querySelector("#profile-hire");
    if (hireButton && !employed) {
      const formerUnavailable = (performer.returnWeeks || 0) > 0;
      const marketFresh = propertyState().selectedSource === "market";
      const resetReturn = !!performer.resetOnReturn;
      hireButton.disabled = formerUnavailable || !hasCapacity() || !canPay(signingFee);
      hireButton.textContent = formerUnavailable
        ? "Not currently available"
        : !hasCapacity()
          ? "Club at capacity"
          : !canPay(signingFee)
            ? "Insufficient cash to hire"
            : `${marketFresh || resetReturn ? "Hire" : "Rehire"} - ${money(signingFee)} fee`;
    }

    document.querySelectorAll(".renewal-offer").forEach(button => {
      const baseBonus = Number(button.dataset.bonus);
      const baseOffer = RENEWAL_OFFERS.find(offer => offer.bonus === baseBonus);
      if (!baseOffer) return;
      const pricedBonus = locationPrice(baseOffer.bonus);
      button.disabled = !canPay(pricedBonus);
      button.textContent = `Offer ${money(pricedBonus)} signing bonus - ${Math.round(baseOffer.chance * 100)}%`;
    });
  }

  document.querySelectorAll(".manager-card").forEach(card => {
    const managerId = card.querySelector("button[data-manager-id]")?.dataset.managerId;
    const manager = managerId ? propertyManagerById(managerId) : null;
    const salary = card.querySelector(".manager-salary strong");
    if (manager && salary) salary.textContent = manager.salary ? `${money(locationPrice(manager.salary))}/week` : "Free";
  });

  const activeManagerCard = document.querySelector(".active-manager-card");
  if (activeManagerCard) {
    const salaryLine = [...activeManagerCard.querySelectorAll("p")].find(element => element.textContent.trim().startsWith("Salary:"));
    const salary = salaryLine?.querySelector("strong");
    const manager = activePropertyManager();
    if (salary) salary.textContent = manager.salary ? `${money(locationPrice(manager.salary))}/week` : "Free";
  }

  const facilityRoot = document.querySelector("#facilities");
  const facilityNote = facilityRoot?.previousElementSibling;
  if (facilityNote?.classList.contains("muted")) facilityNote.textContent = `Each Level 1 to 2 upgrade costs ${money(facilityUpgradeCost(1))}.`;

  const promotionsRoot = document.querySelector("#promotions");
  const promotionsNote = promotionsRoot?.previousElementSibling;
  if (promotionsNote?.classList.contains("muted")) promotionsNote.textContent = `Promotions cost ${money(locationPrice(1000))} times the current Building Level. Each one rolls from -100% to +100% and lasts one week.`;
}

const originalRender = render;
render = function localizedRender() {
  originalRender();
  applyLocalizedPriceDisplay();
};

document.querySelector("#advance-week").onclick = advanceWeek;
document.querySelector("#building-upgrade").onclick = upgradeBuilding;
document.querySelector("#new-game").onclick = newGame;
queueDueContractWarnings();
render();
