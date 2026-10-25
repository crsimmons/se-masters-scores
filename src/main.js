import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import raw from 'virtual:scores';
import { prepareData, genderCheckpoints, ranking } from './data.js';
import './style.css';

echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);
const { teams, checkpoints, sessions } = prepareData(raw.events);
const $ = id => document.getElementById(id);
const palette = ['#1263b1','#d24b36','#128278','#8b4bab','#a16b08','#426148','#c04080','#5265a1'];
const colors = Object.fromEntries(teams.map((t,i) => [t.code, palette[i] || `hsl(${(i * 137.5) % 360} 55% 38%)`]));
let selected = new Set(teams.slice(0,8).map(t => t.code));
let mode = 'event', gender = 'combined', index = checkpoints.length - 1;
const chart = echarts.init($('chart'));
const points = () => {
  const source = mode === 'event' && gender !== 'combined' ? genderCheckpoints(checkpoints, gender) : mode === 'event' ? checkpoints : sessions;
  return source.map(p => ({ ...p, scores: p.genderScores[gender] }));
};
const label = p => mode === 'event' ? `Event ${p.number}` : `Session ${p.session}`;
const rankedTeams = () => {
  const scores = points().at(-1).scores;
  return [...teams].sort((a, b) => (scores[b.code] || 0) - (scores[a.code] || 0) || a.name.localeCompare(b.name));
};
$('meet-count').innerHTML = `<div class="meet-totals"><div class="meet-stat"><strong>${checkpoints.length}</strong><span>events</span></div><div class="meet-stat"><strong>${sessions.length}</strong><span>sessions</span></div></div><p id="results-through"></p>`;
$('results-through').textContent = `Results through event ${checkpoints.at(-1).number}`;
function teamList() {
  const query = $('search').value.toLowerCase().trim();
  $('teams').replaceChildren();
  const scores = points().at(-1).scores;
  const filtered = rankedTeams().filter(t => (t.name + ' ' + t.code).toLowerCase().includes(query));
  for (const t of filtered) {
    const row = document.createElement('label');
    row.className = 'team-row';
    const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = selected.has(t.code);
    input.addEventListener('change', () => { input.checked ? selected.add(t.code) : selected.delete(t.code); render(); });
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = colors[t.code];
    const name = document.createElement('span'); name.className = 'team-name'; name.textContent = t.name;
    const total = document.createElement('span'); total.className = 'team-total'; total.textContent = scores[t.code] || 0;
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
  const dark = document.documentElement.dataset.theme === 'dark';
  const chartMuted = dark ? '#a6bfce' : '#527085';
  const chartBorder = dark ? '#426176' : '#c4d6e4';
  const chartGrid = dark ? '#294557' : '#e2ecf3';
  const chartSurface = dark ? '#142a3b' : '#ffffff';
  chart.setOption({
    animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    textStyle: { fontFamily: 'Arial, sans-serif', color: chartMuted },
    grid: { left: 48, right: 24, top: 28, bottom: 83 },
    tooltip: { trigger: 'axis', confine: true, order: 'valueDesc', backgroundColor: chartSurface, borderColor: chartBorder, textStyle: { color: chartMuted }, extraCssText: 'max-height:280px;overflow-y:auto;', appendToBody: false },
    xAxis: { type: 'category', boundaryGap: false, data: list.map(label), axisLine: { lineStyle: { color: chartBorder } }, axisTick: { show:false }, axisLabel: { color:chartMuted, formatter: v => v.replace('Event ', '').replace('Session ', 'S') } },
    yAxis: { type:'value', min:0, axisLabel:{color:chartMuted}, splitLine:{lineStyle:{color:chartGrid}} },
    dataZoom: [{ type:'slider', bottom: 8, height:24, borderColor:chartBorder, fillerColor: dark ? 'rgba(18,99,177,.24)' : 'rgba(18,99,177,.12)', textStyle:{color:chartMuted} }, {type:'inside'}],
    series: teams.filter(t => selected.has(t.code)).map(t => ({
      name:t.name, type:'line', data:list.map(p => p.scores[t.code] || 0),
      showSymbol: mode === 'session', symbolSize:6, lineStyle:{width:2.5}, itemStyle:{color:colors[t.code]}, emphasis:{focus:'series'}, smooth:false
    }))
  }, {notMerge:true});
  table();
}
function updateCheckpoint(preferredNumber) {
  const list = points();
  $('checkpoint').replaceChildren(...list.map(p => {
    const option = document.createElement('option');
    option.textContent = label(p);
    return option;
  }));
  const preferredIndex = list.findIndex(p => p.number === preferredNumber);
  index = preferredIndex >= 0 ? preferredIndex : list.length - 1;
  $('checkpoint').selectedIndex = index;
}
function setMode(next) {
  mode = next;
  $('by-event').setAttribute('aria-pressed', mode === 'event');
  $('by-session').setAttribute('aria-pressed', mode === 'session');
  updateCheckpoint();
  render();
}
function applyTheme(dark, save = false) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-toggle').textContent = 'Dark mode';
  $('theme-toggle').setAttribute('aria-pressed', String(dark));
  if (save) {
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  }
}
$('theme-toggle').onclick = () => { applyTheme(document.documentElement.dataset.theme !== 'dark', true); render(); };
applyTheme(document.documentElement.dataset.theme === 'dark');
function setGender(next) {
  const currentNumber = points()[index]?.number;
  gender = next;
  for (const category of ['combined', 'open', 'female']) {
    $(`by-${category}`).setAttribute('aria-pressed', String(gender === category));
  }
  $('gender-note').hidden = gender === 'combined';
  updateCheckpoint(mode === 'event' ? undefined : currentNumber);
  teamList(); render();
}
$('by-combined').onclick = () => setGender('combined');
$('by-open').onclick = () => setGender('open');
$('by-female').onclick = () => setGender('female');
$('by-event').onclick = () => setMode('event');
$('by-session').onclick = () => setMode('session');
$('checkpoint').onchange = () => { index = $('checkpoint').selectedIndex; table(); };
$('search').oninput = teamList;
for (const id of ['top','all','clear']) $(id).onclick = () => { selected = new Set((id === 'top' ? rankedTeams().slice(0,8) : id === 'all' ? teams : []).map(t => t.code)); teamList(); render(); };
new ResizeObserver(() => chart.resize()).observe($('chart'));
teamList(); setMode('event');
