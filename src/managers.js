// Property-scoped manager selection, salary strategy, and automatic renewals.
function propertyManagerById(id) {
  return PROPERTY_MANAGERS.find(manager => manager.id === id);
}

function managersForProperty() {
  return PROPERTY_MANAGERS;
}

function activePropertyManager(locationId = null) {
  const property = propertyState(locationId);
  return propertyManagerById(property.managerId) || propertyManagerById("ted");
}

function managerRenewalOffer(manager) {
  return RENEWAL_OFFERS.find(offer => offer.bonus === manager.renewalBonus);
}

function managerUnlocked(manager, locationId = null) {
  const property = propertyState(locationId);
  return !!manager && property.buildingLevel >= manager.requiredBuildingLevel;
}

function selectPropertyManager(managerId, locationId = null) {
  const property = propertyState(locationId);
  const location = locationById(property.locationId);
  const manager = propertyManagerById(managerId);
  if (!manager || !managerUnlocked(manager, property.locationId)) return;
  const current = activePropertyManager(property.locationId);
  if (current.id === manager.id) return;
  property.managerId = manager.id;
  property.clubHistory.unshift({
    week: state.week,
    text: `${manager.name} became Property Manager of ${location.displayName}. Salary: ${manager.salary ? `${money(manager.salary)}/week` : "Free"}.`,
  });
  property.clubHistory = property.clubHistory.slice(0, 120);
  commit(`${manager.name} is now managing ${location.displayName}.`);
}

function attemptManagerRenewals(locationId = null) {
  const property = propertyState(locationId);
  const manager = activePropertyManager(property.locationId);
  const offer = managerRenewalOffer(manager);
  const notices = [];
  property.performers
    .filter(p => p.weeksRemaining === 1 && !p.renewalAttempted && !p.renewalDeclined)
    .forEach(p => {
      if (!canPay(offer.bonus)) {
        const message = `${manager.name} could not offer ${p.name} the ${money(offer.bonus)} renewal bonus because the empire does not have enough cash.`;
        notices.push(message);
        addHistory(message);
        return;
      }
      const result = attemptRenewal(p, offer, {
        offeredBy: manager.name,
        transactionLabel: `${p.name} Renewal — ${manager.name}`,
      });
      notices.push(result.message);
    });
  return notices;
}
