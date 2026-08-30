// Revenue, expenses, promotions, random events, and weekly settlement.
const money = n => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const randomItem = items => items[Math.floor(Math.random() * items.length)];

function promotionCost() {
  return 1000 * propertyState().buildingLevel;
}

function rankBaseRevenue(rank) {
  return Math.round(1500 * Math.pow(1.25, Math.max(0, RANKS.indexOf(rank))));
}

function performerShare(rank) {
  return PAY_SHARES[rank] || PAY_SHARES.F;
}

function performerBasePay(p) {
  return Math.round(rankBaseRevenue(p.rank) * performerShare(p.rank));
}

function normalizeActivePromotions(promotions) {
  if (!promotions || typeof promotions !== "object") return {};
  return Object.fromEntries(Object.entries(promotions).map(([key, promotion]) => {
    const resultPercent = PROMOTION_RESULTS.includes(promotion.resultPercent) ? promotion.resultPercent : resolvePromotionRoll();
    return [key, { ...promotion, resultPercent }];
  }));
}

function workingPerformers() {
  return propertyState().performers.filter(p => p.trainingWeeks === 0 && p.weeksRemaining > 0 && (p.injuryWeeks || 0) <= 0);
}

function rosterCount() {
  return propertyState().performers.filter(p => p.weeksRemaining > 0).length;
}

function hasCapacity() {
  return rosterCount() < CAPACITY[propertyState().buildingLevel];
}

function performerRevenueRows() {
  return workingPerformers().map(p => ({ name: p.name, amount: rankBaseRevenue(p.rank) }));
}

function basePerformerRevenue() {
  return performerRevenueRows().reduce((sum, row) => sum + row.amount, 0);
}

function performerRevenue(p) {
  return rankBaseRevenue(p.rank);
}

function performerPay(p) {
  return Math.round(performerRevenue(p) * performerShare(p.rank));
}

function facilityRevenueRows(base = basePerformerRevenue()) {
  return FACILITY_NAMES
    .map(name => ({ name, amount: Math.round(base * ((propertyState().facilities[name] - 1) * 0.05)) }))
    .filter(row => row.amount !== 0);
}

function facilityRevenueTotal(base = basePerformerRevenue()) {
  return facilityRevenueRows(base).reduce((sum, row) => sum + row.amount, 0);
}

function revenueBeforePromotions() {
  const base = basePerformerRevenue();
  return base + facilityRevenueTotal(base);
}

function resolvePromotionRoll() {
  return randomItem(PROMOTION_RESULTS);
}

function promotionImpact(promotion, revenueBase = revenueBeforePromotions()) {
  return Math.round(revenueBase * (promotion.resultPercent / 100));
}

function promotionRows(revenueBase = revenueBeforePromotions()) {
  return Object.values(propertyState().activePromotions).map(promotion => ({
    label: promotion.name,
    category: promotion.categoryLabel,
    percent: promotion.resultPercent,
    amount: promotionImpact(promotion, revenueBase),
    cost: promotion.cost,
  }));
}

function expenses(sheriffOverride = null, manager = activePropertyManager()) {
  const performerCosts = workingPerformers().reduce((sum, p) => sum + performerPay(p), 0);
  const building = BUILDING_EXPENSES[propertyState().buildingLevel];
  return { performers: performerCosts, manager: manager.salary, ...building, sheriff: sheriffOverride === null ? building.sheriff : sheriffOverride };
}

function expenseTotal(e) {
  return Object.values(e).reduce((sum, amount) => sum + amount, 0);
}

function transactionTotal() {
  return propertyState().transactions.reduce((sum, t) => sum + t.amount, 0);
}

function buildLedgerData({ week, openingCash, sheriffOverride = null, eventRows = [] }) {
  const performerRows = performerRevenueRows();
  const base = performerRows.reduce((sum, row) => sum + row.amount, 0);
  const facilityRows = facilityRevenueRows(base);
  const facilities = facilityRows.reduce((sum, row) => sum + row.amount, 0);
  const beforePromos = base + facilities;
  const promoRows = promotionRows(beforePromos);
  const propertyManager = activePropertyManager();
  const e = expenses(sheriffOverride, propertyManager);
  const txRows = propertyState().transactions.map(t => ({ ...t }));
  const rawPromotionTotal = promoRows.reduce((sum, row) => sum + row.amount, 0);
  const promotionAdjustment = Math.max(-beforePromos, rawPromotionTotal);
  const revenue = beforePromos + promotionAdjustment;
  const events = eventRows.reduce((sum, row) => sum + row.amount, 0);
  const transactions = txRows.reduce((sum, row) => sum + row.amount, 0);
  const totalExpenses = expenseTotal(e);
  const finalNet = revenue + events - totalExpenses - transactions;
  return {
    version: "v1.6",
    week,
    openingCash,
    locationId: propertyState().locationId,
    locationName: locationById(propertyState().locationId).displayName,
    performerRows,
    performerRevenueTotal: base,
    facilityRows,
    facilityRevenueTotal: facilities,
    promotionRows: promoRows,
    transactionRows: txRows,
    eventRows,
    managerId: propertyManager.id,
    managerName: propertyManager.name,
    expenses: e,
    revenueBeforePromotions: beforePromos,
    rawPromotionTotal,
    promotionAdjustment,
    totalRevenue: revenue,
    eventTotal: events,
    transactionTotal: transactions,
    expenseTotal: totalExpenses,
    finalNet,
    endingCash: openingCash + finalNet,
  };
}

function projectedCashAfterWeek() {
  const data = buildLedgerData({ week: state.week, openingCash: state.cash + transactionTotal() });
  return data.endingCash;
}

function buyPromotion(categoryKey, name) {
  const category = PROMOTION_CATEGORIES.find(c => c.key === categoryKey);
  if (!category || propertyState().activePromotions[categoryKey]) return;
  const cost = promotionCost();
  if (!requireCash(cost, `${category.label} promotion`)) return;
  const resultPercent = resolvePromotionRoll({ categoryKey, name });
  state.cash -= cost;
  const promotion = { id: `${categoryKey}-${Date.now()}`, name, categoryKey, categoryLabel: category.label, cost, resultPercent };
  propertyState().activePromotions[categoryKey] = promotion;
  recordTransaction(`${name} Promotion`, cost);
  addHistory(`${name} promotion purchased for ${money(cost)}. Rolled ${resultPercent > 0 ? "+" : ""}${resultPercent}%.`);
  commit(`${name} purchased for ${money(cost)}. Rolled result: ${resultPercent > 0 ? "+" : ""}${resultPercent}%.`);
}

function eligibleEventPerformers() {
  return propertyState().performers.filter(p => p.trainingWeeks === 0 && p.weeksRemaining > 1 && (p.injuryWeeks || 0) <= 0);
}

function makeCashEvent(label, amount, message, historyText = null) {
  return { label, amount, message, historyText: historyText || message };
}

function rollRandomEvent() {
  if (Math.random() >= RANDOM_EVENT_CHANCE) return null;
  const level = propertyState().buildingLevel;
  const candidates = [
    () => makeCashEvent("Bachelor Party", 1000, "A bachelor party came through Vetty's Beauties. +$1,000."),
    () => makeCashEvent("Out-of-Hand Bachelor Party", -2000, "A bachelor party got out of hand. Repairs and cleanup cost $2,000."),
    () => makeCashEvent("Positive Radio Mention", 1000, "A local radio station mentioned Vetty's Beauties. Business picked up. +$1,000."),
    () => makeCashEvent("Cockroach Radio Mention", -3000, "A local radio station mentioned cockroaches in the bar. -$3,000."),
    () => makeCashEvent("Wallet Found", 1000, "Aaron found a wallet in the parking lot. +$1,000."),
    () => makeCashEvent("Club Robbery", -(10000 * level), `Vetty's Beauties was robbed overnight. -${money(10000 * level)}.`, `Vetty's Beauties was robbed: -${money(10000 * level)}.`),
    () => ({ label: "Longhorns Win", amount: 0, sheriffOverride: 0, message: "The Longhorns won. The Sheriff is in a good mood and waived his cut this week.", historyText: "Longhorns won. Sheriff payment waived." }),
    () => ({ label: "Longhorns Loss", amount: 0, sheriffOverride: 10000 * level, message: `The Longhorns lost. The Sheriff is pissed and demands ${money(10000 * level)} this week.`, historyText: `Longhorns lost. Sheriff demanded ${money(10000 * level)}.` }),
  ];
  const eligible = eligibleEventPerformers();
  if (eligible.length) {
    candidates.push(() => {
      const performer = randomItem(eligible);
      const duration = level;
      return {
        label: "Performer Groin Injury",
        amount: 0,
        message: `${performer.name} pulled her groin and will miss ${duration} week${duration === 1 ? "" : "s"}.`,
        historyText: `${performer.name} pulled her groin and will miss ${duration} week${duration === 1 ? "" : "s"}.`,
        applyAfterWeek: () => {
          const current = propertyState().performers.find(p => p.id === performer.id);
          if (current && current.weeksRemaining > 0) current.injuryWeeks = duration;
        },
      };
    });
    candidates.push(() => {
      const performer = randomItem(eligible);
      return {
        label: "Champagne Bottle / Hot-Air-Balloon Death",
        amount: 0,
        message: `A champagne bottle fell from a hot-air balloon and killed ${performer.name}.`,
        historyText: `A champagne bottle fell from a hot-air balloon and killed ${performer.name}.`,
        applyBeforeWeek: () => {
          const current = propertyState().performers.find(p => p.id === performer.id);
          if (!current) return;
          moveFormer(current, "hot-air-balloon death", {
            rank: "F",
            weeklyCost: performerBasePay({ rank: "F" }),
            trainingCompleted: 0,
            returnWeeks: 4,
            resetOnReturn: true,
            skipReturnTick: true,
            lastWeeklyCost: performerBasePay({ rank: "F" }),
            history: [],
          });
        },
      };
    });
  }
  return randomItem(candidates)();
}

function settlePropertyWeek(locationId, closingWeek) {
  return withPropertyContext(locationId, () => {
    const property = propertyState();
    const location = locationById(locationId);
    const openingCash = state.cash + transactionTotal();
    const event = rollRandomEvent();
    const eventRows = [];
    let sheriffOverride = null;
    if (event) {
      if (event.applyBeforeWeek) event.applyBeforeWeek();
      sheriffOverride = Object.prototype.hasOwnProperty.call(event, "sheriffOverride") ? event.sheriffOverride : null;
      eventRows.push({ label: event.label, amount: event.amount || 0 });
    }

    const ledger = buildLedgerData({ week: closingWeek, openingCash, sheriffOverride, eventRows });
    state.cash += ledger.totalRevenue + ledger.eventTotal - ledger.expenseTotal;
    property.lastLedger = ledger;
    property.transactions = [];

    ledger.promotionRows.forEach(row => {
      const result = row.percent > 0 ? "succeeded" : row.percent < 0 ? "backfired" : "broke even";
      addHistory(`${row.label} ${result}: ${row.percent > 0 ? "+" : ""}${row.percent}%. Revenue impact: ${signedMoney(row.amount)}.`, closingWeek);
    });
    if (event) {
      addHistory(event.historyText, closingWeek);
      queueNotification({
        type: "event",
        eyebrow: `${location.displayName.toUpperCase()} — RANDOM EVENT`,
        title: event.label,
        message: event.message,
        week: closingWeek,
      });
    }
    return { event, ledger };
  });
}

function completePropertyWeek(locationId, settlement) {
  return withPropertyContext(locationId, () => {
    const property = propertyState();
    const event = settlement.event;
    let notices = [];
    notices = notices.concat(completePendingUpgrades());

    property.formerPerformers.forEach(p => {
      if ((p.returnWeeks || 0) > 0) {
        if (p.skipReturnTick) {
          p.skipReturnTick = false;
          return;
        }
        p.returnWeeks--;
        if (p.returnWeeks === 0) {
          if (p.resetOnReturn) {
            const message = `Apparently ${p.name} wasn't dead. The hospital had the wrong ${p.name}. ${p.name} has returned to the contract market.`;
            notices.push(message);
            addHistory(message);
          } else {
            notices.push(`${p.name} may be willing to talk again.`);
          }
        }
      }
    });

    [...property.performers].forEach(p => {
      if (p.weeksRemaining > 0) p.weeksRemaining--;
      if ((p.injuryWeeks || 0) > 0) {
        p.injuryWeeks--;
        if (p.injuryWeeks === 0) notices.push(`${p.name} recovered and returned to Working.`);
      }
      if (p.trainingWeeks > 0) {
        p.trainingWeeks--;
        if (p.trainingWeeks === 0) notices.push(finishTraining(p));
      }
      if (p.weeksRemaining === 0) {
        notices.push(`${p.name}'s 26-week contract expired. She may return to the contract market later.`);
        addHistory(`${p.name}'s contract expired.`);
        moveFormer(p, "expired");
      }
    });

    notices = notices.concat(attemptManagerRenewals(locationId));
    queueDueContractWarnings();
    if (event && event.applyAfterWeek) event.applyAfterWeek();
    if (event) notices.unshift(event.message);
    property.activePromotions = {};
    return notices;
  });
}

function advanceWeek() {
  const closingWeek = state.week;
  const viewedLocationId = state.currentLocationId;
  const settlements = {};
  ownedLocationIds().forEach(locationId => {
    settlements[locationId] = settlePropertyWeek(locationId, closingWeek);
  });

  state.week = closingWeek + 1;

  const notices = {};
  ownedLocationIds().forEach(locationId => {
    notices[locationId] = completePropertyWeek(locationId, settlements[locationId]);
  });

  const empireNet = Object.values(settlements).reduce((sum, result) => sum + result.ledger.finalNet, 0);
  const viewedNotices = notices[viewedLocationId] || [];
  const summary = `Week ${closingWeek} closed across ${ownedLocationIds().length} ${ownedLocationIds().length === 1 ? "property" : "properties"}. Empire ledger total: ${signedMoney(empireNet)}.`;
  commit(viewedNotices.length ? `${summary} ${viewedNotices.join(" ")}` : summary);
}
