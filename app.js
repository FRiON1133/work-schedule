/* ================= Состояние ================= */
const STORAGE_KEY = 'scheduleApp.v9';

const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];
const WEEKDAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

const HOURS_REGULAR = '10:00 — 20:00';
const HOURS_SUNDAY  = '10:00 — 18:00';

const state = {
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  workDays: 2,
  restDays: 2,
  employees: [],
  schedule: []
};

/* ================= Утилиты ================= */
const $ = (s) => document.querySelector(s);

function uid() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ================= Сохранение ================= */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    // Восстанавливаем ТОЛЬКО настройки месяца/режима.
    // Сотрудники и таблица при обновлении страницы НЕ сохраняются.
    state.month     = parsed.month     ?? state.month;
    state.year      = parsed.year      ?? state.year;
    state.workDays  = parsed.workDays  ?? state.workDays;
    state.restDays  = parsed.restDays  ?? state.restDays;
    state.employees = [];
    state.schedule  = [];
  } catch(e){}
}

/* ================= UI init ================= */
function initMonthSelect() {
  const sel = $('#month');
  sel.innerHTML = '';
  MONTHS.forEach((name, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = name;
    sel.appendChild(o);
  });
  sel.value = state.month;
}

function syncInputs() {
  $('#month').value = state.month;
  $('#year').value = state.year;
  $('#workDays').value = state.workDays;
  $('#restDays').value = state.restDays;
}

function renderEmployees() {
  const list = $('#employeesList');
  list.innerHTML = '';
  state.employees.forEach(emp => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(emp.name)}</span>
      <button class="remove" type="button" data-id="${emp.id}" aria-label="Удалить">✕</button>`;
    list.appendChild(li);
  });
  $('#empCount').textContent = `(${state.employees.length}/5)`;
}

/* ================= Генерация ================= */
function generateSchedule() {
  const N = state.employees.length;
  if (N < 2) { toast('Добавьте минимум 2 сотрудников'); return false; }
  if (N > 5) { toast('Максимум 5 сотрудников'); return false; }

  const wd = Math.max(1, state.workDays | 0);
  const { year, month } = state;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const schedule = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const dow = dt.getDay();
    const empIndex = Math.floor(d / wd) % N;
    schedule.push({
      day: d,
      weekday: WEEKDAYS_SHORT[dow],
      isSunday: dow === 0,
      employeeId: state.employees[empIndex].id
    });
  }
  state.schedule = schedule;
  save();
  return true;
}

/* ================= Отрисовка ================= */
function renderSchedule() {
  const panel = $('#schedulePanel');
  const wrap  = $('#scheduleWrap');

  if (!state.schedule.length) {
    panel.hidden = true;
    wrap.innerHTML = '';
    return;
  }
  panel.hidden = false;
  $('#scheduleMonthTitle').textContent = MONTHS[state.month];

  const emps = state.employees;

  const rows = state.schedule.map((day, idx) => {
    const emp = emps.find(e => e.id === day.employeeId);
    const empName = emp ? emp.name : '—';
    const hours = day.isSunday ? HOURS_SUNDAY : HOURS_REGULAR;

    return `
      <tr class="${day.isSunday ? 'sunday' : ''}" data-idx="${idx}">
        <td class="cell-date">
          <span class="d-num">${day.day}</span><span class="d-wd">${day.weekday}</span>
        </td>
        <td class="cell-name">${escapeHtml(empName)}</td>
        <td class="cell-hours">${hours}</td>
        <td class="cell-empty"></td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `<table class="schedule"><tbody>${rows}</tbody></table>`;
}

/* ================= Модальное окно ================= */
let modalDayIdx = null;

function openModal(idx) {
  modalDayIdx = idx;
  const day = state.schedule[idx];
  if (!day) return;

  const listEl = $('#modalEmployees');
  listEl.innerHTML = '';

  state.employees.forEach(emp => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = emp.name;
    btn.dataset.id = emp.id;
    if (emp.id === day.employeeId) btn.classList.add('active');
    listEl.appendChild(btn);
  });

  $('#modalNewName').value = '';
  $('#empModal').hidden = false;
  setTimeout(() => { $('#modalNewName').focus(); }, 50);
}

function closeModal() {
  $('#empModal').hidden = true;
  modalDayIdx = null;
}

function pickExistingEmployee(id) {
  if (modalDayIdx === null) return;
  state.schedule[modalDayIdx].employeeId = id;
  save();
  renderSchedule();
  closeModal();
}

function addNewEmployeeFromModal() {
  if (modalDayIdx === null) return;
  const input = $('#modalNewName');
  const name = input.value.trim();
  if (!name) { toast('Введите имя'); return; }

  const existing = state.employees.find(e =>
    e.name.toLowerCase() === name.toLowerCase()
  );

  let empId;
  if (existing) {
    empId = existing.id;
  } else {
    if (state.employees.length >= 5) {
      toast('Максимум 5 сотрудников');
      return;
    }
    const newEmp = { id: uid(), name };
    state.employees.push(newEmp);
    empId = newEmp.id;
    renderEmployees();
  }

  state.schedule[modalDayIdx].employeeId = empId;
  save();
  renderSchedule();
  closeModal();
}

function bindModal() {
  $('#modalEmployees').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    pickExistingEmployee(btn.dataset.id);
  });

  $('#modalAddName').addEventListener('click', addNewEmployeeFromModal);
  $('#modalNewName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addNewEmployeeFromModal(); }
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#empModal').addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeModal();
  });

  // Клик и по имени, и по часам открывает модалку
  $('#scheduleWrap').addEventListener('click', (e) => {
    const cell = e.target.closest('.cell-name, .cell-hours');
    if (!cell) return;
    const tr = cell.closest('tr');
    if (!tr) return;
    openModal(+tr.dataset.idx);
  });
}

/* ================= Экспорт в Word ================= */
async function exportWord() {
  if (!state.schedule.length) { toast('Сначала сгенерируйте график'); return; }
  if (typeof window.docx === 'undefined') {
    toast('Библиотека Word не загрузилась. Проверьте интернет.');
    return;
  }

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ShadingType
  } = window.docx;

  const emps = state.employees;
  const monthName = MONTHS[state.month];

  const SIZE = 28;        // 14 pt — основной текст (полу-пункты)
  const TITLE_SIZE = 40;  // 20 pt — месяц

  // Заголовок месяца — без отступов сверху/снизу
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
    children: [new TextRun({
      text: monthName,
      bold: true,
      italics: true,
      size: TITLE_SIZE
    })]
  });

  // Границы таблицы
  const border = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  // Невидимая граница: NIL — Word не рисует ничего (важно для красного фона!)
  const NO_BORDER = { style: BorderStyle.NIL, size: 0, color: 'auto' };

  // Отступы внутри ячеек (увеличены, чтобы строки были чуть выше)
  const cellMargins  = { top: 70, bottom: 70, left: 100, right: 100 };
  const nameMargins  = { top: 70, bottom: 70, left: 100, right: 60 };
  const hoursMargins = { top: 70, bottom: 70, left: 60,  right: 100 };

  const p = (runs, align) => new Paragraph({
    alignment: align || AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' },
    children: runs
  });

  const rows = state.schedule.map(day => {
    const emp = emps.find(e => e.id === day.employeeId);
    const empName = emp ? emp.name : '';
    const hours = day.isSunday ? HOURS_SUNDAY : HOURS_REGULAR;

    // 1. Дата + день недели
    const dateCell = new TableCell({
      width: { size: 15, type: WidthType.PERCENTAGE },
      margins: cellMargins,
      verticalAlign: 'center',
      borders: { top: border, bottom: border, left: border, right: border },
      children: [p([
        new TextRun({ text: String(day.day), bold: true, size: SIZE, color: '000000' }),
        new TextRun({ text: '  ' + day.weekday, bold: true, size: SIZE, color: '000000' })
      ])]
    });

    // 2. Имя — БЕЗ правой границы
    const nameCell = new TableCell({
      width: { size: 22, type: WidthType.PERCENTAGE },
      margins: nameMargins,
      verticalAlign: 'center',
      shading: day.isSunday
        ? { fill: 'FF0000', type: ShadingType.CLEAR, color: 'auto' }
        : undefined,
      borders: {
        top: border, bottom: border, left: border,
        right: NO_BORDER
      },
      children: [p([
        new TextRun({ text: empName, bold: true, size: SIZE, color: '000000' })
      ])]
    });

    // 3. Часы — БЕЗ левой границы
    const hoursCell = new TableCell({
      width: { size: 20.5, type: WidthType.PERCENTAGE },
      margins: hoursMargins,
      verticalAlign: 'center',
      shading: day.isSunday
        ? { fill: 'FF0000', type: ShadingType.CLEAR, color: 'auto' }
        : undefined,
      borders: {
        top: border, bottom: border, right: border,
        left: NO_BORDER
      },
      children: [p([
        new TextRun({ text: hours, bold: true, size: SIZE, color: '000000' })
      ])]
    });

    // 4. Пустая
    const emptyCell = new TableCell({
      width: { size: 42.5, type: WidthType.PERCENTAGE },
      margins: cellMargins,
      verticalAlign: 'center',
      borders: { top: border, bottom: border, left: border, right: border },
      children: [p([new TextRun({ text: '', bold: true, size: SIZE })])]
    });

    return new TableRow({ children: [dateCell, nameCell, hoursCell, emptyCell] });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: border, bottom: border, left: border, right: border,
      insideHorizontal: border, insideVertical: border
    },
    rows
  });

  const doc = new Document({
    creator: 'График работы PWA',
    title: `${monthName} ${state.year}`,
    styles: {
      default: {
        document: {
          run: { size: SIZE, bold: true, color: '000000' },
          paragraph: { spacing: { before: 0, after: 0, line: 240 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          // Узкие поля 1 см — чтобы 31 строка влезла на одну страницу A4
          margin: { top: 567, right: 567, bottom: 567, left: 567 }
        }
      },
      children: [title, table]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `График_${monthName}_${state.year}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  toast('Файл Word сохранён');
}

/* ================= Обработчики ================= */
function bindEvents() {
  $('#month').addEventListener('change', e => { state.month = +e.target.value; save(); });
  $('#year').addEventListener('change', e => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) { state.year = v; save(); }
  });
  $('#workDays').addEventListener('change', e => {
    const v = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1));
    state.workDays = v; e.target.value = v; save();
    if (state.schedule.length) { generateSchedule(); renderSchedule(); }
  });
  $('#restDays').addEventListener('change', e => {
    const v = Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 1));
    state.restDays = v; e.target.value = v; save();
  });

  const addEmp = () => {
    const input = $('#newEmployee');
    const name = input.value.trim();
    if (!name) return;
    if (state.employees.length >= 5) { toast('Максимум 5 сотрудников'); return; }
    state.employees.push({ id: uid(), name });
    input.value = '';
    input.focus();
    save();
    renderEmployees();
    if (state.schedule.length) { generateSchedule(); renderSchedule(); }
  };
  $('#addEmployee').addEventListener('click', addEmp);
  $('#newEmployee').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addEmp(); }
  });

  $('#employeesList').addEventListener('click', e => {
    const btn = e.target.closest('.remove');
    if (!btn) return;
    state.employees = state.employees.filter(emp => emp.id !== btn.dataset.id);
    save();
    renderEmployees();
    if (state.schedule.length) { generateSchedule(); renderSchedule(); }
  });

  $('#generate').addEventListener('click', () => {
    if (generateSchedule()) { renderSchedule(); toast('График сгенерирован'); }
  });
  $('#exportWord').addEventListener('click', exportWord);

  bindModal();
}

/* ================= Старт ================= */
function start() {
  load();
  initMonthSelect();
  syncInputs();
  renderEmployees();
  bindEvents();
  // Ничего не рендерим — таблица появится после кнопки «Сгенерировать».
}
document.addEventListener('DOMContentLoaded', start);

/* ================= Service Worker ================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW:', err));
  });
}