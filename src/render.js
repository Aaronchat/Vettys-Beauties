// All screen drawing and profile panel behavior.
function imageOrPlaceholder(src, alt, label, small, className) {
  return `<div class="${className} art-frame"><img src="${src}" alt="${alt}" onerror="this.parentElement.classList.add('missing-art')" /><span>${label}</span><small>${small}</small></div>`;
}

function statusFor(p) {
  if (p.weeksRemaining <= 0) return "Former";
  if ((p.injuryWeeks || 0) > 0) return `Injured (${p.injuryWeeks}w)`;
  if (p.trainingWeeks) return `Training (${p.trainingWeeks}w)`;
  return "Working";
}

function rosterSummary(p, source) {
  if (source === "former") return `Rank ${p.rank} - ${statusFor(p)}`;
  if ((p.injuryWeeks || 0) > 0) return `Rank ${p.rank} - Injured - ${p.injuryWeeks}w`;
  if (p.trainingWeeks) return `Rank ${p.rank} - Training - ${p.trainingWeeks}w left`;
  return `Rank ${p.rank} - Working - ${p.weeksRemaining}w`;
}

function renderLocations() {
  const root = document.querySelector("#locations");
  root.innerHTML = LOCATION_REGIONS.map(region => {
    const cards = LOCATIONS.filter(location => location.regionId === region.id).map(location => {
      const owned = isLocationOwned(location.id);
      const current = state.currentLocationId === location.id;
      const canBuy = !owned && canPay(location.purchasePrice);
      const status = current ? "Current" : owned ? "Owned" : "Not Owned";
      const button = current
        ? `<button disabled>Current Property</button>`
        : owned
          ? `<button data-location-action="view" data-location-id="${location.id}">View ${location.city}</button>`
          : `<button data-location-action="buy" data-location-id="${location.id}" ${canBuy ? "" : "disabled"}>${canBuy ? `Buy — ${money(location.purchasePrice)}` : `Need ${money(location.purchasePrice)}`}</button>`;
      return `<article class="location-card ${current ? "current" : ""}"><p class="eyebrow">${status}</p><h3>${location.displayName}${current ? " — Current" : ""}</h3><p class="muted">${owned ? "Part of the Vetty's Beauties empire." : `Purchase price: ${money(location.purchasePrice)}`}</p>${button}</article>`;
    }).join("");
    return `<section class="location-region"><h3>${region.name}</h3><div class="location-grid">${cards}</div></section>`;
  }).join("");
  root.querySelectorAll("button[data-location-action]").forEach(button => {
    button.onclick = () => {
      if (button.dataset.locationAction === "buy") purchaseLocation(button.dataset.locationId);
      else selectLocation(button.dataset.locationId);
    };
  });
}

function renderPropertyManager() {
  const root = document.querySelector("#property-manager");
  const active = activePropertyManager();
  const activeOffer = managerRenewalOffer(active);
  const activeSalary = active.salary ? `${money(active.salary)}/week` : "Free";
  const cards = managersForProperty().map(manager => {
    const unlocked = managerUnlocked(manager);
    const selected = manager.id === active.id;
    const offer = managerRenewalOffer(manager);
    const salary = manager.salary ? `${money(manager.salary)}/week` : "Free";
    const buttonText = selected ? "Current Manager" : unlocked ? `Choose ${manager.name}` : `Requires Building Level ${manager.requiredBuildingLevel}`;
    return `<article class="manager-card ${selected ? "selected" : ""}"><p class="eyebrow">${selected ? "CURRENT MANAGER" : "PROPERTY MANAGER"}</p><h3>${manager.name}</h3><p class="manager-salary">Salary: <strong>${salary}</strong></p><p class="muted">Contract strategy: ${money(offer.bonus)} bonus — ${Math.round(offer.chance * 100)}% acceptance</p><button data-manager-id="${manager.id}" ${selected || !unlocked ? "disabled" : ""}>${buttonText}</button></article>`;
  }).join("");
  root.innerHTML = `<section class="active-manager-card"><p class="eyebrow">${currentLocation().displayName.toUpperCase()} PROPERTY MANAGER</p><h2>${active.name}</h2><p class="manager-role">Property Manager</p><p>Salary: <strong>${activeSalary}</strong></p><p>Contract strategy: <strong>${money(activeOffer.bonus)} bonus — ${Math.round(activeOffer.chance * 100)}% acceptance</strong></p><p class="muted">Automatically attempts performer renewals when 1 contract week remains.</p></section><div class="manager-grid">${cards}</div>`;
  root.querySelectorAll("button[data-manager-id]").forEach(button => {
    button.onclick = () => selectPropertyManager(button.dataset.managerId);
  });
}

function renderFacilities() {
  const root = document.querySelector("#facilities");
  root.innerHTML = "";
  FACILITY_NAMES.forEach(name => {
    const level = propertyState().facilities[name];
    const target = propertyState().pendingFacilities[name];
    const cost = facilityUpgradeCost(level);
    const maxed = level >= 5;
    const locked = level > propertyState().buildingLevel;
    const upgrading = !!target;
    const shortCash = !canPay(cost);
    const el = document.createElement("article");
    el.className = "facility";
    el.innerHTML = `<p class="eyebrow">FACILITY</p><h3>${name}</h3><div class="level">Level ${level}${upgrading ? ` -> ${target}` : ""}</div><p class="muted">${upgrading ? `Upgrading to Level ${target}. Effects begin next week.` : `Revenue bonus: +${(level - 1) * 5}%`}</p><button ${maxed || locked || upgrading || shortCash ? "disabled" : ""}>${maxed ? "Max Level" : locked ? "Building upgrade required" : upgrading ? "Upgrade pending" : shortCash ? `Insufficient cash - need ${money(cost)}` : `Upgrade - ${money(cost)}`}</button>`;
    el.querySelector("button").onclick = () => upgradeFacility(name);
    root.appendChild(el);
  });
}

function rosterButton(p, source) {
  const el = document.createElement("button");
  el.className = "roster-item";
  const formerNote = source === "former" && p.returnWeeks > 0 ? ` - Not currently available - Possible return in ${p.returnWeeks} week${p.returnWeeks === 1 ? "" : "s"}` : "";
  el.innerHTML = `${imageOrPlaceholder(ASSETS.performers[p.id], `${p.name} portrait`, p.name.toUpperCase(), "Portrait coming soon", "thumb")}<span><strong>${p.name}</strong><small>${rosterSummary(p, source)}${formerNote}</small></span>`;
  el.onclick = () => chooseProfile(p.id, source);
  return el;
}

function renderRoster() {
  const working = document.querySelector("#working-performers");
  const training = document.querySelector("#training-performers");
  const former = document.querySelector("#former-performers");
  working.innerHTML = "";
  training.innerHTML = "";
  former.innerHTML = "";
  propertyState().performers.filter(p => !p.trainingWeeks).forEach(p => working.appendChild(rosterButton(p, "active")));
  propertyState().performers.filter(p => p.trainingWeeks).forEach(p => training.appendChild(rosterButton(p, "active")));
  propertyState().formerPerformers.forEach(p => former.appendChild(rosterButton(p, "former")));
  if (!working.children.length) working.innerHTML = `<p class="muted empty">No working performers.</p>`;
  if (!training.children.length) training.innerHTML = `<p class="muted empty">No one is training.</p>`;
  if (!former.children.length) former.innerHTML = `<p class="muted empty">No former performers yet.</p>`;
}

function renderMarket() {
  const root = document.querySelector("#recruitment");
  root.innerHTML = "";
  const items = marketPerformers();
  const full = !hasCapacity();
  document.querySelector("#market-status").textContent = full
    ? `Club at capacity: ${rosterCount()}/${CAPACITY[propertyState().buildingLevel]} performer slots filled.`
    : `Open slots: ${CAPACITY[propertyState().buildingLevel] - rosterCount()}. Signing fee: ${money(SIGNING_FEE)}.`;
  items.forEach(item => {
    const p = item.performer;
    const rate = hireRate(item);
    const disabled = full || !canPay(SIGNING_FEE);
    const freshRules = item.kind === "fresh" || item.kind === "fresh-return";
    const el = document.createElement("article");
    el.className = "performer recruit";
    el.tabIndex = 0;
    el.innerHTML = `${imageOrPlaceholder(ASSETS.performers[p.id], `${p.name} portrait`, p.name.toUpperCase(), "Portrait coming soon", "portrait")}<p class="eyebrow">${freshRules ? "AVAILABLE CONTRACT" : "FORMER PERFORMER"}</p><h3>${p.name}</h3><p class="muted">${p.concept}</p><dl><dt>Rank</dt><dd>${freshRules ? "F" : p.rank}</dd><dt>Weekly pay</dt><dd>${money(rate)}</dd><dt>Contract</dt><dd>Fresh 26 weeks</dd><dt>Signing fee</dt><dd>${money(SIGNING_FEE)}</dd></dl><button ${disabled ? "disabled" : ""}>${full ? "Club at capacity" : !canPay(SIGNING_FEE) ? "Insufficient cash" : `Hire - ${money(SIGNING_FEE)}`}</button>`;
    el.onclick = () => chooseProfile(p.id, freshRules && item.kind !== "fresh-return" ? "market" : "former");
    el.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chooseProfile(p.id, freshRules && item.kind !== "fresh-return" ? "market" : "former");
      }
    };
    el.querySelector("button").onclick = e => {
      e.stopPropagation();
      hire(p.id, item.kind);
    };
    root.appendChild(el);
  });
  if (!items.length) root.innerHTML = `<p class="muted empty">No available contracts.</p>`;
}

function renderProfile() {
  const p = selectedPerformer();
  const root = document.querySelector("#profile");
  root.classList.toggle("open", !!propertyState().profileOpen && !!p);
  if (!p) {
    root.innerHTML = "";
    return;
  }
  const employed = propertyState().performers.some(x => x.id === p.id);
  const fireFee = employed ? Math.round(performerPay(p) * p.weeksRemaining * 0.5) : 0;
  const formerUnavailable = !employed && (p.returnWeeks || 0) > 0;
  const marketFresh = propertyState().selectedSource === "market";
  const resetReturn = !employed && p.resetOnReturn;
  const askingRate = employed ? performerPay(p) : marketFresh || resetReturn ? performerBasePay({ rank: "F" }) : formerUnavailable ? performerBasePay(p) : hireRate({ kind: "former", performer: p });
  const statusText = marketFresh ? "Available contract" : formerUnavailable ? `Not currently available - possible return in ${p.returnWeeks} week${p.returnWeeks === 1 ? "" : "s"}` : statusFor(p);
  const weeklyRevenue = employed && p.trainingWeeks === 0 && p.weeksRemaining > 0 && (p.injuryWeeks || 0) <= 0 ? money(performerRevenue(p)) : employed && (p.injuryWeeks || 0) > 0 ? "$0" : "N/A";
  const weeklyPay = employed && p.trainingWeeks === 0 && p.weeksRemaining > 0 && (p.injuryWeeks || 0) <= 0 ? money(performerPay(p)) : employed && (p.injuryWeeks || 0) > 0 ? "$0" : money(askingRate);
  const history = (p.history || []).slice(-5).join("<br>") || "No training or contract history yet.";
  const trainDisabled = p.trainingWeeks || (p.injuryWeeks || 0) > 0 || p.weeksRemaining <= 4 || p.rank === "A" || !canPay(TRAINING_COST);
  const trainText = p.rank === "A" ? "Max Rank" : (p.injuryWeeks || 0) > 0 ? "Cannot train while injured" : canPay(TRAINING_COST) ? "Train - $5,000" : "Insufficient cash for training";
  const renewalButtons = employed && p.weeksRemaining === 1 && !p.renewalAttempted && !p.renewalDeclined
    ? RENEWAL_OFFERS.map(offer => `<button class="renewal-offer" data-bonus="${offer.bonus}" ${!canPay(offer.bonus) ? "disabled" : ""}>Offer ${money(offer.bonus)} signing bonus - ${Math.round(offer.chance * 100)}%</button>`).join("")
    : "";
  root.innerHTML = `<div class="profile-shell"><button id="profile-close" class="profile-close">Close</button><div class="profile-grid">${imageOrPlaceholder(ASSETS.performers[p.id], `${p.name} portrait`, p.name.toUpperCase(), "Portrait coming soon", "profile-art")}<div><p class="eyebrow">PERFORMER PROFILE</p><h2>${p.name}</h2><p class="muted">${p.concept}</p><dl class="profile-dl"><dt>Rank</dt><dd>${resetReturn ? "F" : p.rank}</dd><dt>Weekly pay</dt><dd>${weeklyPay}</dd><dt>Performer share</dt><dd>${Math.round(performerShare(resetReturn ? "F" : p.rank) * 100)}%</dd><dt>Weekly revenue</dt><dd>${weeklyRevenue}</dd><dt>Contract</dt><dd>${employed ? `${p.weeksRemaining} weeks` : marketFresh || resetReturn ? "Fresh 26 weeks" : "Former"}</dd><dt>Status</dt><dd>${statusText}</dd><dt>Training completed</dt><dd>${resetReturn ? 0 : p.trainingCompleted || 0}</dd><dt>Injury</dt><dd>${(p.injuryWeeks || 0) > 0 ? `${p.injuryWeeks} week${p.injuryWeeks === 1 ? "" : "s"} remaining` : "N/A"}</dd><dt>Last exit</dt><dd>${p.exitReason || "N/A"}</dd></dl><div class="profile-actions">${employed ? `<button id="profile-train" ${trainDisabled ? "disabled" : ""}>${trainText}</button>${renewalButtons}<button id="profile-fire" ${!canPay(fireFee) ? "disabled" : ""}>${canPay(fireFee) ? `Fire - ${money(fireFee)} fee` : "Insufficient cash to fire"}</button>` : `<button id="profile-hire" ${formerUnavailable || !hasCapacity() || !canPay(SIGNING_FEE) ? "disabled" : ""}>${formerUnavailable ? "Not currently available" : !hasCapacity() ? "Club at capacity" : !canPay(SIGNING_FEE) ? "Insufficient cash to hire" : `${marketFresh || resetReturn ? "Hire" : "Rehire"} - ${money(SIGNING_FEE)} fee`}</button>`}</div><p class="muted">${employed ? renewalStatus(p) : `${marketFresh || resetReturn ? "Available contract" : "Former performer"}. Hire creates a fresh 26-week contract once available.`}</p><h3>History</h3><p class="muted">${history}</p></div></div></div>`;
  document.querySelector("#profile-close").onclick = closeProfile;
  if (employed) {
    document.querySelector("#profile-train").onclick = () => train(p.id);
    document.querySelectorAll(".renewal-offer").forEach(button => {
      button.onclick = () => renew(p.id, Number(button.dataset.bonus));
    });
    document.querySelector("#profile-fire").onclick = () => firePerformer(p.id);
  } else {
    document.querySelector("#profile-hire").onclick = () => hire(p.id, marketFresh || resetReturn ? "fresh-return" : "former");
  }
}

function signedMoney(amount) {
  if (amount > 0) return `+${money(amount)}`;
  if (amount < 0) return `-${money(Math.abs(amount))}`;
  return money(0);
}

function amountClass(amount) {
  return amount >= 0 ? "positive" : "negative";
}

function renderLedgerRows(rows, empty, signed = false) {
  if (!rows.length) return `<p class="muted empty">${empty}</p>`;
  return rows.map(row => `<div class="ledger-row"><span>${row.label || row.name}</span><strong class="${amountClass(row.amount)}">${signed ? signedMoney(row.amount) : money(row.amount)}</strong></div>`).join("");
}

function renderLedgerData(data, mode) {
  const expense = data.expenses;
  const managerName = data.managerName || "Ted";
  const managerExpense = expense.manager || 0;
  const performerTotal = data.performerRevenueTotal ?? data.performerRows.reduce((sum, row) => sum + row.amount, 0);
  const buildingTotal = data.facilityRevenueTotal ?? data.facilityRows.reduce((sum, row) => sum + row.amount, 0);
  const promoRows = data.promotionRows.map(row => ({ label: `${row.label} (${row.percent > 0 ? "+" : ""}${row.percent}%)`, amount: row.amount }));
  return `<p class="muted">${mode === "last" ? `Closed Week ${data.week}.` : `Projected Week ${data.week} if you advance now. Random events are unknown until the button is pressed.`}</p><div class="ledger-row total"><span>Opening cash</span><strong>${money(data.openingCash)}</strong></div><h3>Performer Revenue</h3>${renderLedgerRows(data.performerRows, "No working performers generating revenue.")}<div class="ledger-row subtotal"><span>Total performer revenue</span><strong class="positive">${money(performerTotal)}</strong></div><h3>Building / Facility Revenue</h3>${renderLedgerRows(data.facilityRows, "No building revenue bonuses yet.")}<div class="ledger-row subtotal"><span>Total building revenue</span><strong class="positive">${money(buildingTotal)}</strong></div><div class="ledger-row total"><span>Total club revenue before promotions</span><strong class="positive">${money(data.revenueBeforePromotions)}</strong></div><h3>Promotion Effects</h3>${renderLedgerRows(promoRows, "No promotions active.", true)}<div class="ledger-row subtotal"><span>Total promotions</span><strong class="${amountClass(data.promotionAdjustment)}">${signedMoney(data.promotionAdjustment)}</strong></div><div class="ledger-row total"><span>Final club revenue</span><strong class="positive">${money(data.totalRevenue)}</strong></div><h3>Random Events</h3>${renderLedgerRows(data.eventRows, "No random event affected this ledger.", true)}<div class="ledger-row subtotal"><span>Total random events</span><strong class="${amountClass(data.eventTotal)}">${signedMoney(data.eventTotal)}</strong></div><h3>This Week Transactions</h3>${data.transactionRows.length ? data.transactionRows.map(t => `<div class="ledger-row"><span>${t.label}</span><strong class="negative">-${money(t.amount)}</strong></div>`).join("") : `<p class="muted empty">No one-time transactions this week.</p>`}<div class="ledger-row subtotal"><span>Total transactions</span><strong class="${data.transactionTotal ? "negative" : "positive"}">${data.transactionTotal ? `-${money(data.transactionTotal)}` : money(0)}</strong></div><h3>Recurring Expenses</h3><div class="ledger-row"><span>Performer contracts</span><strong class="negative">-${money(expense.performers)}</strong></div><div class="ledger-row"><span>Property Manager — ${managerName}</span><strong class="${managerExpense ? "negative" : "positive"}">${managerExpense ? `-${money(managerExpense)}` : money(0)}</strong></div><div class="ledger-row"><span>Property tax</span><strong class="negative">-${money(expense.tax)}</strong></div><div class="ledger-row"><span>Operations</span><strong class="negative">-${money(expense.operations)}</strong></div><div class="ledger-row"><span>Advertising</span><strong class="negative">-${money(expense.advertising)}</strong></div><div class="ledger-row"><span>Sheriff</span><strong class="${expense.sheriff === 0 ? "positive" : "negative"}">${expense.sheriff === 0 ? money(0) : `-${money(expense.sheriff)}`}</strong></div><div class="ledger-row subtotal"><span>Total expenses</span><strong class="negative">-${money(data.expenseTotal)}</strong></div><div class="ledger-row total"><span>Final weekly net</span><strong class="${amountClass(data.finalNet)}">${signedMoney(data.finalNet)}</strong></div><div class="ledger-row total"><span>${mode === "last" ? "Ending cash" : "Projected cash after advancing week"}</span><strong class="${amountClass(data.endingCash)}">${money(data.endingCash)}</strong></div>`;
}

function renderLedger() {
  const current = buildLedgerData({ week: state.week, openingCash: state.cash + transactionTotal() });
  const last = propertyState().lastLedger ? `<details class="subpanel" open><summary>Last Closed Week</summary>${renderLedgerData(propertyState().lastLedger, "last")}</details>` : "";
  document.querySelector("#ledger").innerHTML = `${last}<details class="subpanel" open><summary>Current Week Projection</summary>${renderLedgerData(current, "current")}</details>`;
}

function renderPromotions() {
  const root = document.querySelector("#promotions");
  const cost = promotionCost();
  const revenueBase = revenueBeforePromotions();
  root.innerHTML = "";
  PROMOTION_CATEGORIES.forEach(category => {
    const selected = propertyState().activePromotions[category.key];
    const el = document.createElement("article");
    el.className = "promotion-card";
    const result = selected ? `<div class="promotion-result"><strong>${selected.name}</strong><span>Cost: ${money(selected.cost)}</span><span>Result: ${selected.resultPercent > 0 ? "+" : ""}${selected.resultPercent}%</span><span>Total revenue impact: ${signedMoney(promotionImpact(selected, revenueBase))}</span></div>` : `<p class="muted">One ${category.label} promotion may run this week.</p>`;
    const buttons = category.promotions.map(name => {
      const disabled = selected || !canPay(cost);
      return `<button data-category="${category.key}" data-promo="${name}" ${disabled ? "disabled" : ""}>${selected && selected.name !== name ? "Locked this week" : !canPay(cost) ? `Insufficient cash - need ${money(cost)}` : `${name} - ${money(cost)}`}</button>`;
    }).join("");
    el.innerHTML = `<p class="eyebrow">PROMOTION</p><h3>${category.label}</h3>${result}<div class="promotion-actions">${buttons}</div>`;
    root.appendChild(el);
  });
  root.querySelectorAll("button[data-category]").forEach(button => {
    button.onclick = () => buyPromotion(button.dataset.category, button.dataset.promo);
  });
}

function renderHistory() {
  const root = document.querySelector("#club-history");
  if (!propertyState().clubHistory.length) {
    root.innerHTML = `<p class="muted empty">No major history yet.</p>`;
    return;
  }
  root.innerHTML = propertyState().clubHistory.map(entry => `<div class="history-row"><strong>Week ${entry.week}</strong><span>${entry.text}</span></div>`).join("");
}

function renderNotification() {
  const root = document.querySelector("#notification-overlay");
  const notification = propertyState().notifications[0];
  root.classList.toggle("open", !!notification);
  if (!notification) {
    root.innerHTML = "";
    return;
  }
  const performer = notification.performerId ? byId(notification.performerId) : null;
  const visual = performer
    ? imageOrPlaceholder(ASSETS.performers[performer.id], `${performer.name} portrait`, performer.name.toUpperCase(), "Portrait coming soon", "notification-art")
    : `<div class="notification-symbol">!</div>`;
  const action = performer
    ? `<button id="notification-profile" class="primary">Open ${performer.name}'s Profile</button>`
    : "";
  root.innerHTML = `<div class="notification-shell ${notification.type === "contract" ? "contract-alert" : ""}"><button id="notification-close" class="notification-close">Close</button><div class="notification-grid">${visual}<div><p class="eyebrow">${notification.eyebrow}</p><h2>${notification.title}</h2><p class="notification-week">Week ${notification.week}</p><p class="notification-message">${notification.message}</p><div class="notification-actions">${action}<button id="notification-dismiss">Dismiss</button></div></div></div></div>`;
  document.querySelector("#notification-close").onclick = dismissNotification;
  document.querySelector("#notification-dismiss").onclick = dismissNotification;
  if (performer) document.querySelector("#notification-profile").onclick = () => openNotificationPerformer(performer.id);
}

function render() {
  const location = currentLocation();
  document.querySelector("#location-eyebrow").textContent = location.displayName.toUpperCase();
  document.querySelector("#week").textContent = state.week;
  document.querySelector("#cash").textContent = money(state.cash);
  document.querySelector("#building-level").textContent = propertyState().buildingLevel;
  document.querySelector("#capacity").textContent = CAPACITY[propertyState().buildingLevel];
  document.querySelector("#capacity-used").textContent = rosterCount();
  document.querySelector("#sticky-cash").textContent = money(state.cash);
  document.querySelector("#sticky-week").textContent = state.week;
  document.querySelector("#sticky-building").textContent = propertyState().buildingLevel;
  document.querySelector("#sticky-capacity").textContent = `${rosterCount()}/${CAPACITY[propertyState().buildingLevel]}`;
  document.querySelector("#building-art").innerHTML = imageOrPlaceholder(ASSETS.buildings[propertyState().buildingLevel] || "", `Vetty's Beauties Building Level ${propertyState().buildingLevel}`, `BUILDING LEVEL ${propertyState().buildingLevel}`, "Artwork coming soon", "building-art");
  const b = document.querySelector("#building-upgrade");
  const cost = buildingUpgradeCost(propertyState().buildingLevel);
  const buildingReady = canUpgradeBuilding();
  const shortCash = !canPay(cost);
  b.textContent = propertyState().buildingLevel >= 5 ? "Building Maxed" : propertyState().pendingBuildingLevel ? `Building upgrade pending: Level ${propertyState().pendingBuildingLevel}` : buildingReady && shortCash ? `Insufficient cash - need ${money(cost)}` : `Upgrade Building - ${money(cost)}`;
  b.disabled = !buildingReady || shortCash;
  document.querySelector("#building-requirement").textContent = propertyState().pendingBuildingLevel ? `Building Level ${propertyState().pendingBuildingLevel} completes next week.` : propertyState().buildingLevel >= 5 ? "Vetty's Beauties has reached Level 5." : `All facilities must reach Level ${propertyState().buildingLevel + 1} first.`;
  renderLocations();
  renderFacilities();
  renderPropertyManager();
  renderRoster();
  renderMarket();
  renderProfile();
  renderPromotions();
  renderLedger();
  renderHistory();
  renderNotification();
  saveState();
}
