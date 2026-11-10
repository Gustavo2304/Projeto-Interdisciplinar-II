// Tela de login (RF04).
const form = document.getElementById('formLogin');
const erro = document.getElementById('erro');

if (new URLSearchParams(location.search).get('expirou')) {
  erro.textContent = 'Sua sessão terminou. Entre novamente.';
  erro.hidden = false;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  erro.hidden = true;
  if (!form.login.value.trim() || !form.senha.value) {
    erro.textContent = 'Informe usuário e senha.';
    erro.hidden = false;
    return;
  }
  const botao = form.querySelector('button');
  botao.disabled = true;
  try {
    await App.api('/auth/login', { method: 'POST', body: { login: form.login.value, senha: form.senha.value } });
    location.href = 'painel.html';
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
    form.senha.value = '';
    form.senha.focus();
  } finally {
    botao.disabled = false;
  }
});
