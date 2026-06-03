const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatBirthdate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} г.`;
}

function formatLastSeen(ts) {
  if (!ts) return 'никогда';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${m}`;
}

const params = new URLSearchParams(window.location.search);
const name = params.get('name');

if (name) {
  document.getElementById('search-name').value = name;
  loadProfile(name);
}

async function loadProfile(nick) {
  const content = document.getElementById('profile-content');
  const notFound = document.getElementById('not-found');

  try {
    const res = await fetch(`/api/profile/${encodeURIComponent(nick)}`);
    if (!res.ok) {
      content.hidden = true;
      notFound.hidden = false;
      return;
    }
    const p = await res.json();
    content.hidden = false;
    notFound.hidden = true;

    document.getElementById('profile-nick').textContent = p.name;
    document.getElementById('f-nick').textContent = p.name;
    document.getElementById('f-name').textContent = p.realName || '—';
    document.getElementById('f-gender').textContent = p.genderLabel;
    document.getElementById('f-birth').textContent = formatBirthdate(p.birthdate);
    document.getElementById('f-zodiac').textContent = p.zodiac || '—';
    document.getElementById('f-about').textContent = p.about || '—';
    const emailEl = document.getElementById('f-email');
    if (p.email) {
      emailEl.innerHTML = `<a href="mailto:${p.email}">${p.email}</a>`;
    } else {
      emailEl.textContent = '—';
    }
    document.getElementById('f-lastseen').textContent = formatLastSeen(p.lastSeen);
    document.title = `Инфа чатланина ${p.name} — МГЧ V2.31`;
  } catch {
    content.hidden = true;
    notFound.hidden = false;
  }
}
