const number = new Intl.NumberFormat('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
export const money = cents => number.format(cents / 100);
export const palette = ['#276a99','#09816d','#b45b29','#7656aa','#9d3d61','#54802f','#99703e','#527988','#6b7280','#c05a54'];
export const byId = id => document.getElementById(id);
export function metric(label, value) {
  const element = document.createElement('div');
  element.className = 'metric';
  const caption = document.createElement('span');
  caption.textContent = label;
  const content = document.createElement('strong');
  content.textContent = value;
  element.append(caption, content);
  return element;
}
export function chart(id) {
  const element = byId(id);
  const instance = echarts.init(element);
  const observer = new ResizeObserver(() => instance.resize());
  observer.observe(element);
  return options => instance.setOption({
    animation: false, color: palette, aria: {enabled: true},
    textStyle: {fontFamily: 'system-ui, sans-serif'},
    tooltip: {trigger: 'axis', confine: true, valueFormatter: value => `${money(value)} 元`},
    ...options,
  }, {notMerge: true});
}
export const valueAxis = {
  type: 'value', axisLabel: {formatter: value => value === 0 ? '0' : value / 1000000 + '万'},
  splitLine: {lineStyle: {color: '#e5edf3'}},
};
export const grid = {left: 10, right: 20, top: 44, bottom: 12, containLabel: true};
