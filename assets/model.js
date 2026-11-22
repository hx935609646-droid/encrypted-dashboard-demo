export function monthAt(start, index) {
  const [year, month] = start.split('-').map(Number);
  const serial = year * 12 + month - 1 + index;
  return `${Math.floor(serial / 12)}-${String(serial % 12 + 1).padStart(2, '0')}`;
}

export function project(config) {
  const c = key => {
    const value = config[key];
    if (!Number.isFinite(value) || value < 0 || value > 1e9) {
      throw new Error('金额须为 0 至 10 亿元之间的数字');
    }
    return Math.round(value * 100);
  };
  let total = c('initial');
  let reserve = Math.min(c('reserve'), total);
  let cumulativeReserveUse = 0;
  const initial = {month: config.asOf, total, reserve, ordinary: total - reserve};
  const rows = [];
  const at = (month, key, time) => month === config[time] ? c(key) : 0;
  for (let month = 1; month <= config.months; month += 1) {
    const transitioned = month >= config.transition;
    const salary = transitioned ? c('salary') : 0;
    const support = c(transitioned ? 'nonSalary' : 'bridgeIncome');
    const aid = config.addReceivables ? at(month, 'aid', 'aidMonth') : 0;
    const reimbursement = config.addReceivables ? at(month, 'reimbursement', 'reimbursementMonth') : 0;
    const sale = at(month, 'sellPhone', 'sellMonth');
    let medical;
    if (month < config.specialMonth) medical = c('intensive');
    else if (month === config.specialMonth) medical = c('special') + c('specialOther');
    else medical = c(transitioned ? 'maintenance' : 'earlyMaintenance');
    const nutrition = config.medicalIncludesNutrition ? 0 : c('nutrition');
    const rent = c(transitioned ? 'rent' : 'currentRent');
    const social = c(transitioned ? 'social' : 'currentSocial');
    const tuition = month >= config.tuitionMonth &&
      (month - config.tuitionMonth) % config.tuitionInterval === 0 ? c('tuition') : 0;
    const purchase = at(month, 'buyPhone', 'buyMonth');
    const oneOff = at(month, 'oneOff', 'oneOffMonth');
    const living = c('living') + c('car');
    const expense = medical + nutrition + rent + social + tuition + purchase + oneOff + living;
    const income = salary + support + aid + reimbursement + sale;
    total += income - expense;
    // Preserve the designated reserve while ordinary cash covers the balance.
    const reserveUse = Math.max(0, reserve - Math.max(0, total));
    reserve -= reserveUse;
    cumulativeReserveUse += reserveUse;
    rows.push({
      month: monthAt(config.start, month - 1), total, reserve, ordinary: total - reserve,
      reserveUse, cumulativeReserveUse, salary, support, aid, reimbursement, sale,
      medical, nutrition, rent, social, tuition, purchase, oneOff, living, income, expense,
    });
  }
  return {initial, rows};
}
