// A small escaping template tag. Interpolated values are escaped unless they came
// from html`...` themselves, so prospect-entered text can never become markup.

class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value instanceof SafeHtml) return value.value;
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, index) => {
    out += renderValue(value) + strings[index + 1];
  });
  return new SafeHtml(out);
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso) {
  return DATE_FORMAT.format(new Date(iso));
}

export function formatDateTime(iso) {
  return DATE_TIME_FORMAT.format(new Date(iso));
}

export function announce(message) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  // A separate task, so screen readers notice the change even for a repeated message.
  setTimeout(() => {
    live.textContent = message;
  }, 50);
}
