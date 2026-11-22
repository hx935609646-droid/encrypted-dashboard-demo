import {chart, grid, metric, money, palette, valueAxis} from './common.js';

export function show(data) {
  const byId = id => document.getElementById('history-' + id);
  const plot = id => chart('history-' + id);
  const months = data.months;
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const groups = [...new Set(months.flatMap(row => Object.keys(row.expenseGroups)))];
  const [endYear, endMonth, endDay] = data.end.split('-').map(Number);
  const endIsPartial = endDay !== new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const startIsPartial = !data.start.endsWith('-01');
  function displayMonth(month) {
    const notes = [];
    if (startIsPartial && month === data.start.slice(0, 7)) notes.push(`自${Number(data.start.slice(8))}日`);
    if (endIsPartial && month === data.end.slice(0, 7)) notes.push(`截至${endDay}日`);
    return month + (notes.length ? `（${notes.join('，')}）` : '');
  }
  byId('coverage').textContent = `${data.start} 至 ${data.end}` +
    (endIsPartial ? ` · ${endMonth} 月为部分月份` : '');
  for (const row of months) byId('month').add(new Option(displayMonth(row.month), row.month));
  for (const key of groups) byId('category').add(new Option(key, key));
  const flow = plot('flow'), net = plot('net'), income = plot('income');
  const expense = plot('expense'), trend = plot('trend');
  const totals = data.totals;
  byId('metrics').replaceChildren(
    metric('已确认收入 · 元', money(totals.income)),
    metric('已识别支出 · 元', money(totals.spend)),
    metric('已确认净流入 · 元', money(totals.income - totals.spend)),
    metric('全期交易 · 笔', totals.count.toLocaleString('zh-CN')),
  );
  const rent = data.allocation;
  byId('allocation').textContent = `实付统计保留 ${rent.paymentCount} 笔车租，共 ${money(rent.unplacedAmount)} 元。每笔覆盖 ${rent.monthsPerPayment} 个月，生活成本等值 ${money(rent.monthlyEquivalent)} 元/月。具体起止月份未确认，${money(rent.unplacedAmount)} 元均待落月。历史旧房租覆盖月份也未确认。已抵扣的住房定金只计一次。`;
  byId('reconciliation').innerHTML = '<table><thead><tr><th>月份</th><th>笔数</th><th>收入（元）</th><th>支出（元）</th><th>待核转出（元）</th></tr></thead><tbody>' +
    months.map(row => `<tr><td>${displayMonth(row.month)}</td><td>${row.count}</td><td>${money(row.income)}</td><td>${money(row.spend)}</td><td>${money(row.pending)}</td></tr>`).join('') + '</tbody></table>';

  function render() {
    const selected = byId('month').value;
    const category = byId('category').value;
    const exclude = byId('exclude').checked;
    const filtered = months.filter(row => !selected || row.month === selected);
    const selectedGroups = groups.filter(key => !category || category === key ||
      (category === 'nonMedical' && key !== '医疗'));
    const labels = filtered.map(row => displayMonth(row.month));
    const axis = {type: 'category', data: labels, axisLabel: {formatter: value => value.slice(5, 7) + '月' + (value.length > 7 ? '*' : '')}};
    const revenues = filtered.map(row => row.income - (exclude ? row.nonRecurring : 0));
    const spending = filtered.map(row => row.spend);
    const legend = {type: 'scroll', top: 0};
    const bar = (name, values, color) => ({name, type: 'bar', data: values, itemStyle: {color}, barMaxWidth: 44});
    flow({grid, legend, xAxis: axis, yAxis: valueAxis, series: [
      bar(exclude ? '筛选后收入' : '收入', revenues, palette[0]), bar('全部支出', spending, palette[2]),
    ]});
    net({grid, xAxis: axis, yAxis: valueAxis, series: [bar('净现金流',
      revenues.map((value, i) => ({value: value - spending[i], itemStyle: {color: value >= spending[i] ? palette[1] : palette[2]}})),
      palette[1],
    )]});
    function structure(draw, entries, color) {
      entries.sort((a, b) => b[1] - a[1]);
      draw({grid: {...grid, top: 12}, xAxis: valueAxis,
        yAxis: {type: 'category', inverse: true, data: entries.map(([key]) => key)},
        series: [bar('金额', entries.map(([, value]) => value), color)]});
    }
    const earnings = ['亲友支持', '公众号赞赏', '其他确认收入'].map(key => [
      key, filtered.reduce((total, row) => total + (row.incomeGroups[key] || 0), 0),
    ]);
    structure(income, earnings, palette[0]);
    structure(expense, selectedGroups.map(key => [
      key, filtered.reduce((total, row) => total + (row.expenseGroups[key] || 0), 0),
    ]), palette[1]);
    trend({grid, legend, xAxis: axis, yAxis: valueAxis, series: selectedGroups.map(key => ({
      ...bar(key, filtered.map(row => row.expenseGroups[key] || 0), palette[groups.indexOf(key)]), stack: 'spending',
    }))});
    byId('trend-title').textContent = category === '医疗' ? '医疗支出趋势' : '月度支出趋势';
    byId('scope').textContent = `图表范围 ${labels[0]}${labels.length > 1 ? ' 至 ' + labels.at(-1) : ''} · ${sum(filtered, 'count').toLocaleString('zh-CN')} 笔。类别仅筛选支出结构和趋势。收入来源保留实收全口径。* 部分月份。`;
  }
  for (const id of ['month', 'category', 'exclude']) byId(id).addEventListener('change', render);
  render();
}
