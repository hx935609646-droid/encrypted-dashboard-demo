import {show as showHistory} from './history.js';
import {show as showForecast} from './forecast.js';

const byId = id => document.getElementById(id);
const nav = byId('pages-nav');
nav.style.display = 'none';
const field = byId('passphrase');
const button = byId('unlock-button');
const encoder = new TextEncoder();
const base64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));

async function decrypt(material, name) {
  const response = await fetch(`./data/${name}.enc.json`, {cache: 'no-store'});
  if (!response.ok) throw new Error('fetch');
  const envelope = await response.json();
  if (envelope.v !== 1 || envelope.iterations !== 600000) throw new Error('format');
  const salt = base64(envelope.salt), iv = base64(envelope.iv);
  if (salt.length !== 32 || iv.length !== 12) throw new Error('format');
  const key = await crypto.subtle.deriveKey(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations: envelope.iterations},
    material, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
  const bytes = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv, additionalData: encoder.encode(`family-finance/pages/v1/${name}`), tagLength: 128},
    key, base64(envelope.ciphertext));
  try {
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  } finally {
    new Uint8Array(bytes).fill(0);
  }
}

let unlockedData;
const initialized = new Set();
function showPage() {
  if (!unlockedData) return;
  const page = location.hash === '#forecast' ? 'forecast' : 'history';
  for (const name of ['history', 'forecast']) {
    byId(`${name}-panel`).hidden = page !== name;
    nav.querySelector(`[href="#${name}"]`).toggleAttribute('aria-current', page === name);
  }
  if (!initialized.has(page)) {
    (page === 'history' ? showHistory : showForecast)(unlockedData[page]);
    initialized.add(page);
  }
}
window.addEventListener('hashchange', showPage);
byId('lock').addEventListener('click', () => location.reload());
window.addEventListener('pageshow', event => {
  if (event.persisted && unlockedData) location.reload();
});
byId('unlock').addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled || unlockedData) return;
  const error = byId('unlock-error');
  if (!globalThis.crypto?.subtle || !isSecureContext) {
    error.textContent = '此浏览器环境无法解密，请核对 HTTPS 和微信版本。';
    return;
  }
  button.disabled = true;
  error.textContent = '';
  const bytes = encoder.encode(field.value);
  field.value = '';
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    bytes.fill(0);
    const [history, forecast] = await Promise.all(['history', 'forecast'].map(name => decrypt(material, name)));
    unlockedData = {history, forecast};
    showPage();
    nav.hidden = false;
    nav.style.display = '';
    byId('gate').hidden = true;
  } catch {
    unlockedData = undefined;
    byId('history-panel').hidden = true;
    byId('forecast-panel').hidden = true;
    error.textContent = '无法解锁。请检查口令，或刷新后再试。';
    field.focus();
  } finally {
    bytes.fill(0);
    button.disabled = false;
  }
});
