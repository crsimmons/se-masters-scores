import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import raw from 'virtual:scores';
import { prepareData, ranking } from './data.js';
import './style.css';

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);
const { teams, checkpoints, sessions } = prepareData(raw.events);
const $ = id => document.getElementById(id);
const palette = ['#1263b1','#d24b36','#128278','#8b4bab','#a16b08','#426148','#c04080','#5265a1'];
const colors = Object.fromEntries(teams.map((t,i) => [t.code, palette[i] || `hsl(${(i * 137.5) % 360} 55% 38%)`]));
let selected = new Set(teams.slice(0,8).map(t => t.code));
let mode = 'event', index = checkpoints.length - 1;
const chart = echarts.init($('chart'));
const points = () => mode === 'event' ? checkpoints : sessions;
const label = p => mode === 'event' ? `Event ${p.number}` : `Session ${p.session}`;
$('meet-count').innerHTML = `<strong>${checkpoints.length}</strong><span>completed events<br>across ${sessions.length} sessions</span>`;
function teamList() {
  const query = $('search').value.toLowerCase().trim();
  $('teams').replaceChildren();
  const filtered = teams.filter(t => (t.name + ' ' + t.code).toLowerCase().includes(query));
  for (const t of filtered) {
    const row = document.createElement('label');
    row.className = 'team-row';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = selected.has(t.code);
    input.addEventListener('change', () => { input.checked ? selected.add(t.code) : selected.delete(t.code); render(); });
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = colors[t.code];
    const name = document.createElement('span'); name.className = 'team-name'; name.textContent = t.name;
    const total = document.createElement('span'); total.className = 'team-total'; total.textContent = t.total;
    row.append(input, swatch, name, total); $('teams').append(row);
  }
  $('no-results').hidden = filtered.length > 0;
}
function table() {
  const list = points(), current = list[index], previous = list[index - 1];
  $('checkpoint-detail').textContent = mode === 'event' ? current.name : `Through event ${current.number}: ${current.name}`;
  $('standings').replaceChildren();
  const sorted = teams.filter(t => selected.has(t.code)).sort((a,b) => (current.scores[b.code] || 0) - (current.scores[a.code] || 0) || a.name.localeCompare(b.name));
  for (const t of sorted) {
    const row = document.createElement('tr');
    const value = current.scores[t.code] || 0;
    [ranking(current.scores, t.code), t.name, value, '+' + (value - (previous?.scores[t.code] || 0))].forEach((v,i) => {
      const cell = document.createElement(i === 1 ? 'th' : 'td');
      if(i === 1) { cell.scope = 'row'; const dot = document.createElement('span'); dot.className = 'swatch'; dot.style.background = colors[t.code]; cell.append(dot, document.createTextNode(v)); }
      else cell.textContent = v;
      row.append(cell);
    });
    $('standings').append(row);
  }
  $('empty').hidden = selected.size > 0;
}
function render() {
  const list = points();
  $('selection-count').textContent = `${selected.size} / ${teams.length}`;
  chart.setOption({
    animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    textStyle: { fontFamily: 'Arial, sans-serif' },
    grid: { left: 48, right: 24, top: 28, bottom: 83 },
    tooltip: { trigger: 'axis', confine: true, order: 'valueDesc', extraCssText: 'max-height:280px;overflow-y:auto;', appendToBody: false },
    xAxis: { type: 'category', boundaryGap: false, data: list.map(label), axisLine: { lineStyle: { color: '#c4d6e4' } }, axisTick: { show:false }, axisLabel: { color:'#527085', formatter: v => v.replace('Event ', '').replace('Session ', 'S') } },
    yAxis: { type:'value', min:0, axisLabel:{color:'#527085'}, splitLine:{lineStyle:{color:'#e2ecf3'}} },
    dataZoom: [{ type:'slider', bottom: 8, height:24, borderColor:'#d4e2ec', fillerColor:'rgba(18,99,177,.12)', textStyle:{color:'#527085'} }, {type:'inside'}],
    series: teams.filter(t => selected.has(t.code)).map(t => ({
      name:t.name, type:'line', data:list.map(p => p.scores[t.code] || 0),
      showSymbol: mode === 'session', symbolSize:6, lineStyle:{width:2.5}, itemStyle:{color:colors[t.code]}, emphasis:{focus:'series'}, smooth:false
    }))
  }, {notMerge:true});
  table();
}
function setMode(next) {
  mode = next;
  $('by-event').setAttribute('aria-pressed', mode === 'event');
  $('by-session').setAttribute('aria-pressed', mode === 'session');
  $('chart-subtitle').textContent = mode === 'event' ? 'After each completed event' : 'At the end of each session';
  $('checkpoint').replaceChildren(...points().map(p => { const option = document.createElement('option'); option.textContent = label(p); return option; }));
  index = points().length - 1; $('checkpoint').selectedIndex = index; render();
}
$('by-event').onclick = () => setMode('event');
$('by-session').onclick = () => setMode('session');
$('checkpoint').onchange = () => { index = $('checkpoint').selectedIndex; table(); };
$('search').oninput = teamList;
for (const id of ['top','all','clear']) $(id).onclick = () => { selected = new Set((id === 'top' ? teams.slice(0,8) : id === 'all' ? teams : []).map(t => t.code)); teamList(); render(); };
new ResizeObserver(() => chart.resize()).observe($('chart'));
teamList(); setMode('event');
