// Training purchases and rank advancement.
function train(id) {
  const p = propertyState().performers.find(x => x.id === id);
  if (!p || p.trainingWeeks) return;
  if (p.rank === "A") {
    setMessage(`${p.name} is already Max Rank.`);
    render();
    return;
  }
  if ((p.injuryWeeks || 0) > 0) {
    setMessage(`${p.name} cannot train while injured.`);
    render();
    return;
  }
  if (!requireCash(TRAINING_COST, "training")) return;
  state.cash -= TRAINING_COST;
  recordTransaction(`${p.name} Training`, TRAINING_COST);
  p.trainingWeeks = 4;
  addHistory(`${p.name} started training. Cost: ${money(TRAINING_COST)}.`);
  commit(`${p.name} left for four weeks of dance and specialization training. Her contract clock keeps running.`);
}

function finishTraining(p) {
  const i = RANKS.indexOf(p.rank);
  if (i < RANKS.length - 1) p.rank = RANKS[i + 1];
  p.trainingCompleted = (p.trainingCompleted || 0) + 1;
  p.renewalOffer = null;
  const message = `${p.name} returned from training as Rank ${p.rank}. Revenue and weekly pay now use her new rank.`;
  addHistory(`${p.name} completed training and reached Rank ${p.rank}.`);
  return message;
}
