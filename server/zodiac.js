const SIGNS = [
  { name: 'Козерог', from: [1, 1], to: [1, 19] },
  { name: 'Водолей', from: [1, 20], to: [2, 18] },
  { name: 'Рыбы', from: [2, 19], to: [3, 20] },
  { name: 'Овен', from: [3, 21], to: [4, 19] },
  { name: 'Телец', from: [4, 20], to: [5, 20] },
  { name: 'Близнецы', from: [5, 21], to: [6, 20] },
  { name: 'Рак', from: [6, 21], to: [7, 22] },
  { name: 'Лев', from: [7, 23], to: [8, 22] },
  { name: 'Дева', from: [8, 23], to: [9, 22] },
  { name: 'Весы', from: [9, 23], to: [10, 22] },
  { name: 'Скорпион', from: [10, 23], to: [11, 21] },
  { name: 'Стрелец', from: [11, 22], to: [12, 21] },
  { name: 'Козерог', from: [12, 22], to: [12, 31] },
];

export function zodiacSign(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  for (const s of SIGNS) {
    const [fm, fd] = s.from;
    const [tm, td] = s.to;
    const afterStart = m > fm || (m === fm && day >= fd);
    const beforeEnd = m < tm || (m === tm && day <= td);
    if (afterStart && beforeEnd) return s.name;
  }
  return '';
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatBirthdate(isoDate) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} г.`;
}

export function formatLastSeen(ts) {
  if (!ts) return 'никогда';
  const d = new Date(ts);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h}:${min}`;
}
