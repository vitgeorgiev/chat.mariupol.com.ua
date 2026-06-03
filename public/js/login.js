document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  let errorEl = document.getElementById('login-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = 'login-error';
    errorEl.style.color = 'red';
    errorEl.style.fontWeight = 'bold';
    form.parentElement.insertBefore(errorEl, form);
  }
  errorEl.textContent = '';

  const body = {
    name: form.name.value,
    password: form.password.value,
    channel: form.channel.value,
  };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Ошибка входа';
      return;
    }
    sessionStorage.setItem('mgch_pwd', form.password.value);
    const q = new URLSearchParams({
      name: data.user.name,
      channel: data.channel,
      gender: data.user.gender,
      color: data.user.color,
      msgColor: data.user.msgColor || data.user.color,
      coloredNames: data.user.coloredNames !== false ? '1' : '0',
      coloredContent: data.user.coloredContent ? '1' : '0',
    });
    window.location.href = `/chat.html?${q}`;
  } catch {
    errorEl.textContent = 'Ошибка соединения с сервером';
  }
});

const registered = new URLSearchParams(window.location.search).get('registered');
if (registered) {
  const form = document.getElementById('login-form');
  if (form?.name) form.name.value = registered;
  let note = document.getElementById('registered-note');
  if (!note) {
    note = document.createElement('p');
    note.id = 'registered-note';
    note.style.color = 'green';
    note.style.fontWeight = 'bold';
    form.parentElement.insertBefore(note, form);
  }
  note.textContent = `Регистрация успешна! Войдите как ${registered}.`;
}
