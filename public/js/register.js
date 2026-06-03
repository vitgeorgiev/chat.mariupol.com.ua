document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('error');
  errorEl.style.display = 'none';

  const body = {
    name: form.name.value,
    password: form.password.value,
    password2: form.password2.value,
    realName: form.realName.value,
    gender: form.gender.value,
    birthdate: form.birthdate.value,
    email: form.email.value,
    about: form.about.value,
    color: form.color.value,
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Ошибка регистрации';
      errorEl.style.display = 'block';
      return;
    }
    window.location.href = '/?registered=' + encodeURIComponent(data.user.name);
  } catch {
    errorEl.textContent = 'Ошибка соединения с сервером';
    errorEl.style.display = 'block';
  }
});
