import {chart, grid, metric, money, palette, valueAxis} from './common.js';
import {monthAt, project} from './model.js';

const mainFields = {
  initial: '初始现金（元）', reserve: '其中应急储备（元）',
  bridgeIncome: '过渡期非工资收入（月）', salary: '过渡后税后工资（月）',
  nonSalary: '过渡后非工资收入（月）', rent: '过渡后房租（月）',
  social: '过渡后社保自付（月）', living: '日常生活费（月）',
  maintenance: '过渡后维持期医费（月）',
};
const advancedFields = {
  intensive: '普通强化治疗（月）', specialMonth: '阶段性治疗安排（月序）',
  special: '阶段性治疗费用（元）', specialOther: '阶段性治疗当月其他医费（元）',
  earlyMaintenance: '过渡期维持医费（月）', nutrition: '医学营养（月）',
  medicalIncludesNutrition: '医费输入已含营养',
  aidMonth: '救助款到账（月序）', reimbursementMonth: '报销款到账（月序）',
  addReceivables: '应收在初始现金之外',
  tuitionMonth: '下次学费付款（月序）', buyPhone: '购机支出（元）',
  buyMonth: '购机付款（月序）', sellPhone: '旧机回款（元）',
  sellMonth: '旧机回款（月序）', oneOff: '搬家等一次性支出（元）',
  oneOffMonth: '一次性支出（月序）',
};

export function show(defaults) {
  const byId = id => document.getElementById('forecast-' + id);
  const plot = id => chart('forecast-' + id);
  const config = {...defaults};
  const inputs = {};
  const draw = plot('balance');
  const budget = byId('budget');
  const medicalCase = byId('medical-case');
  for (const [index, value] of defaults.medicalCases.entries()) {
    medicalCase.add(new Option(`${['低', '中', '高'][index]} · ${value} 元/月`, value));
  }
  medicalCase.add(new Option('自定义', ''));
  byId('transition-note').textContent = `自 ${monthAt(defaults.start, defaults.transition - 1)} 起采用过渡后预算。过渡前每月房租 ${defaults.currentRent} 元、社保 ${defaults.currentSocial} 元。车租每月 ${defaults.car} 元。过渡后的非工资收入应已包含固定支持。`;
  byId('schedule-note').textContent = `月序从 ${defaults.start} 起为 1。阶段性治疗位于强化期最后一个月。未来学费每 ${defaults.tuitionInterval} 个月支付 ${defaults.tuition} 元，已付学费不重复扣除。`;
  for (const [name, value] of Object.entries(defaults.budgets)) {
    budget.add(new Option(`${name} · ${value.toLocaleString('zh-CN')} 元/月`, name));
  }
  budget.add(new Option('自定义', ''));
  for (const [id, labels] of [['main-fields', mainFields], ['advanced-fields', advancedFields]]) {
    for (const [key, text] of Object.entries(labels)) {
      const label = document.createElement('label');
      label.textContent = text;
      const input = document.createElement('input');
      input.id = key;
      if (typeof defaults[key] === 'boolean') {
        input.type = 'checkbox';
        label.className = 'check';
      } else {
        input.type = 'number';
        input.required = true;
        const month = key.endsWith('Month');
        input.min = month ? 1 : 0;
        input.max = month ? defaults.months : 1e9;
        input.step = month ? 1 : 0.01;
      }
      input.addEventListener('input', update);
      inputs[key] = input;
      label.append(input);
      byId(id).append(label);
    }
  }
  const asYuan = key => money(config[key] * 100);
  function reset() {
    for (const [key, input] of Object.entries(inputs)) {
      if (input.type === 'checkbox') input.checked = defaults[key];
      else input.value = defaults[key];
    }
    update();
  }
  function update() {
    for (const [key, input] of Object.entries(inputs)) {
      if (!input.validity.valid) {
        byId('error').textContent = `请检查「${input.parentElement.textContent}」的输入。图表保留上一组有效结果。`;
        return;
      }
      config[key] = input.type === 'checkbox' ? input.checked : input.valueAsNumber;
    }
    byId('error').textContent = '';
    budget.value = Object.keys(defaults.budgets).find(name => defaults.budgets[name] === config.living) || '';
    medicalCase.value = defaults.medicalCases.includes(config.maintenance) ? String(config.maintenance) : '';
    render();
  }
  function render() {
    const {initial, rows} = project(config);
    const end = rows.at(-1);
    const hit = rows.find(row => row.total <= 0);
    const firstUse = rows.find(row => row.reserveUse > 0);
    byId('metrics').replaceChildren(
      metric('初始总现金 · 元', money(initial.total)),
      metric('其中应急储备 · 元', money(initial.reserve)),
      metric('首次余额耗尽', hit?.month || '120 个月内未耗尽'),
      metric('期末总余额 · 元', money(end.total)),
    );
    byId('baseline').textContent = `现金估值基准日（日期假设）：${config.asOf}。`;
    byId('receivables').textContent = `待到账共 ${money((config.aid + config.reimbursement) * 100)} 元 · 救助款 ${asYuan('aid')} 元、报销款 ${asYuan('reimbursement')} 元。` +
      (config.addReceivables ? ` 假设分别于 ${monthAt(config.start, config.aidMonth - 1)}、${monthAt(config.start, config.reimbursementMonth - 1)} 入账。` : ' 所选情景已将两笔应收包含在期初，预测期间不再入账。');
    byId('forecast-range').textContent = `${rows[0].month} 至 ${end.month} · 人民币元 · 图轴以万元显示`;
    byId('runway').textContent = `首次动用储备 ${firstUse?.month || '120 个月内未动用'} · 期末普通资金 ${money(end.ordinary)} 元 · 期末剩余储备 ${money(end.reserve)} 元 · 已动用储备 ${money(end.cumulativeReserveUse)} 元`;
    draw({
      grid, legend: {type: 'scroll', top: 0},
      xAxis: {type: 'category', data: [initial, ...rows].map(row => row.month),
        axisLabel: {hideOverlap: true, interval: (i, value) => i === 0 || value.endsWith('-12'),
          formatter: (value, index) => index === 0 ? '期初' : value.slice(0, 4)}},
      yAxis: valueAxis, series: [
        ['总现金', 'total', palette[0]], ['普通生活资金', 'ordinary', palette[1]], ['医疗应急储备', 'reserve', palette[2]],
      ].map(([name, key, color]) => ({
        name, type: 'line', showSymbol: false, data: [initial, ...rows].map(row => row[key]), itemStyle: {color},
      })),
    });
    const columns = {
      month: '月份', salary: '税后工资', support: '非工资收入', aid: '救助',
      reimbursement: '报销', sale: '旧机回款', rent: '房租', social: '社保',
      living: '日常与车租', medical: '治疗', nutrition: '营养', tuition: '学费',
      purchase: '购机', oneOff: '一次性支出', expense: '总支出', total: '总余额',
      ordinary: '普通生活资金', reserve: '应急储备', reserveUse: '当月动用储备',
    };
    byId('forecast-table').innerHTML = '<table><thead><tr>' +
      Object.values(columns).map(label => `<th>${label}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(row => '<tr>' + Object.keys(columns).map(key =>
        `<td>${key === 'month' ? row[key] : money(row[key])}</td>`).join('') + '</tr>').join('') +
      '</tbody></table>';
  }
  budget.addEventListener('change', () => {
    if (budget.value) inputs.living.value = defaults.budgets[budget.value];
    update();
  });
  medicalCase.addEventListener('change', () => {
    if (medicalCase.value) inputs.maintenance.value = medicalCase.value;
    update();
  });
  byId('reset').addEventListener('click', reset);
  reset();
}
