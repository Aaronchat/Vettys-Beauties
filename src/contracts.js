// Performer contracts, hiring, renewals, firing, and return-to-market rules.
function contractFor(performer, overrides = {}) {
  return {
    ...performer,
    rank: "F",
    weeklyCost: 200,
    weeksRemaining: 26,
    trainingWeeks: 0,
    injuryWeeks: 0,
    revenueMultiplier: 1,
    trainingCompleted: 0,
    history: [],
    renewalAttempted: false,
    renewalDeclined: false,
    renewalWarningShown: false,
    rehireOffer: null,
    ...overrides,
  };
}

function absenceWeeks() {
  return Math.floor(Math.random() * 5) + 2;
}

function moveFormer(p, reason, overrides = {}) {
  const previousRate = performerPay(p);
  const former = {
    ...p,
    weeksRemaining: 0,
    trainingWeeks: 0,
    injuryWeeks: 0,
    lastWeeklyCost: previousRate,
    exitReason: reason,
    returnWeeks: reason === "expired" ? absenceWeeks() : 0,
    rehireOffer: null,
    renewalOffer: null,
    renewalAttempted: false,
    renewalDeclined: false,
    history: [...(p.history || []), `${reason} at Week ${state.week}`],
    ...overrides,
  };
  propertyState().formerPerformers = propertyState().formerPerformers.filter(x => x.id !== p.id).concat(former);
  propertyState().performers = propertyState().performers.filter(x => x.id !== p.id);
  propertyState().selectedPerformerId = former.id;
  propertyState().selectedSource = "former";
}

function marketPerformers() {
  const property = propertyState();
  const activeIds = new Set(property.performers.map(p => p.id));
  const formerIds = new Set(property.formerPerformers.map(p => p.id));
  const fresh = PERFORMER_POOL
    .filter(p => p.id !== "zella" && !activeIds.has(p.id) && !formerIds.has(p.id))
    .map(p => ({ kind: "fresh", performer: contractFor(p) }));
  const former = property.formerPerformers
    .filter(p => !activeIds.has(p.id) && (p.returnWeeks || 0) <= 0)
    .map(p => ({ kind: p.resetOnReturn ? "fresh-return" : "former", performer: p }));
  return [...fresh, ...former];
}

function hireRate(item) {
  if (item.kind === "fresh" || item.kind === "fresh-return" || item.performer.resetOnReturn) return performerBasePay({ rank: "F" });
  return performerBasePay(item.performer);
}

function renewalStatus(p) {
  if (p.renewalDeclined) return "Offer rejected. She will leave when this contract expires.";
  if (p.renewalAttempted) return "Renewal offer already used for this contract.";
  if (p.weeksRemaining === 1) return "Renewal window open. Choose one signing bonus.";
  return `Renewal locked until 1 week remains. Current contract: ${p.weeksRemaining} weeks.`;
}

function hire(id, kind = "fresh") {
  if (!hasCapacity()) {
    setMessage(`Club at capacity: ${rosterCount()}/${CAPACITY[propertyState().buildingLevel]} performer slots filled.`);
    render();
    return;
  }
  if (!requireCash(SIGNING_FEE, "signing fee")) return;
  const active = propertyState().performers.some(p => p.id === id && p.weeksRemaining > 0);
  if (active) return;
  const former = propertyState().formerPerformers.find(p => p.id === id);
  if (former && (former.returnWeeks || 0) > 0) {
    setMessage(`${former.name} is not currently available. Possible return in ${former.returnWeeks} week${former.returnWeeks === 1 ? "" : "s"}.`);
    render();
    return;
  }
  const freshReturn = kind === "fresh-return" || (former && former.resetOnReturn);
  const base = freshReturn ? byId(id) : former || contractFor(byId(id));
  const item = { kind: freshReturn ? "fresh-return" : former ? "former" : kind, performer: base };
  const weeklyCost = hireRate(item);
  state.cash -= SIGNING_FEE;
  recordTransaction(`${base.name} Signing Fee`, SIGNING_FEE);
  propertyState().performers.push(contractFor(base, { weeklyCost, weeksRemaining: 26, trainingWeeks: 0, injuryWeeks: 0, renewalOffer: null, renewalAttempted: false, renewalDeclined: false, renewalWarningShown: false, rehireOffer: null, returnWeeks: 0, exitReason: null, resetOnReturn: false, history: freshReturn ? [] : base.history || [] }));
  propertyState().formerPerformers = propertyState().formerPerformers.filter(p => p.id !== id);
  propertyState().selectedPerformerId = id;
  propertyState().selectedSource = "active";
  propertyState().profileOpen = true;
  addHistory(`${base.name} signed a fresh 26-week contract. Signing fee: ${money(SIGNING_FEE)}.`);
  commit(`${base.name} signed a fresh 26-week contract. Signing fee paid: ${money(SIGNING_FEE)}.`);
}

function attemptRenewal(p, offer, options = {}) {
  const offeredBy = options.offeredBy || null;
  const transactionLabel = options.transactionLabel || `${p.name} Renewal Signing Bonus`;
  p.renewalAttempted = true;
  const accepted = Math.random() < offer.chance;
  if (!accepted) {
    p.renewalDeclined = true;
    const message = offeredBy
      ? `${p.name} rejected ${offeredBy}'s ${money(offer.bonus)} automatic renewal offer and will leave when her contract expires.`
      : `${p.name} rejected the ${money(offer.bonus)} renewal offer. No signing bonus was paid.`;
    addHistory(message);
    return { accepted: false, message };
  }
  state.cash -= offer.bonus;
  recordTransaction(transactionLabel, offer.bonus);
  p.weeksRemaining = 26;
  p.renewalAttempted = false;
  p.renewalDeclined = false;
  p.renewalWarningShown = false;
  p.renewalOffer = null;
  const message = offeredBy
    ? `${offeredBy} automatically renewed ${p.name} with a ${money(offer.bonus)} bonus. Fresh 26-week contract signed.`
    : `${p.name} accepted the ${money(offer.bonus)} renewal offer. Fresh 26-week contract signed.`;
  addHistory(message);
  return { accepted: true, message };
}

function renew(id, bonus) {
  const p = propertyState().performers.find(x => x.id === id);
  if (!p || p.weeksRemaining <= 0) return;
  const offer = RENEWAL_OFFERS.find(o => o.bonus === bonus);
  if (!offer) return;
  if (p.weeksRemaining !== 1) {
    setMessage(`${p.name}'s renewal is locked until exactly 1 week remains.`);
    render();
    return;
  }
  if (p.renewalAttempted || p.renewalDeclined) {
    setMessage(`${p.name} already received her one renewal offer for this contract.`);
    render();
    return;
  }
  if (!requireCash(offer.bonus, "renewal signing bonus")) return;
  const result = attemptRenewal(p, offer);
  commit(result.message);
}

function firePerformer(id) {
  const p = propertyState().performers.find(x => x.id === id);
  if (!p) return;
  const fee = Math.round(performerPay(p) * p.weeksRemaining * 0.5);
  if (!requireCash(fee, "contract termination")) return;
  if (!confirm(`Terminate ${p.name}'s contract for ${money(fee)}?`)) return;
  state.cash -= fee;
  recordTransaction(`${p.name} Contract Cancellation`, fee);
  addHistory(`${p.name} was fired. Cancellation fee: ${money(fee)}.`);
  moveFormer(p, "fired");
  commit(`${p.name}'s contract was terminated. Cancellation fee paid: ${money(fee)}.`);
}
