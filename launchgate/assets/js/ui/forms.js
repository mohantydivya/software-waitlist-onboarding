// Form fields with labels, help and inline errors wired together for screen readers.

import { html } from './dom.js';

function describedBy(id, help) {
  return help ? `${id}-help ${id}-error` : `${id}-error`;
}

function fieldFooter(id, help) {
  return html`
    ${help ? html`<div class="form-text" id="${id}-help">${help}</div>` : ''}
    <div class="invalid-feedback" id="${id}-error"></div>`;
}

export function textField({ id, name = id, label, type = 'text', value = '', help, autocomplete, required = true, inputmode }) {
  return html`
    <label class="form-label" for="${id}">${label}${required ? '' : html` <span class="text-secondary">(optional)</span>`}</label>
    <input class="form-control" id="${id}" name="${name}" type="${type}" value="${value}"
      ${autocomplete ? html`autocomplete="${autocomplete}"` : ''}
      ${inputmode ? html`inputmode="${inputmode}"` : ''}
      ${required ? html`aria-required="true"` : ''}
      aria-describedby="${describedBy(id, help)}">
    ${fieldFooter(id, help)}`;
}

export function selectField({ id, name = id, label, options, value = '', placeholder, help, required = true }) {
  return html`
    <label class="form-label" for="${id}">${label}</label>
    <select class="form-select" id="${id}" name="${name}"
      ${required ? html`aria-required="true"` : ''} aria-describedby="${describedBy(id, help)}">
      ${placeholder !== undefined ? html`<option value="">${placeholder}</option>` : ''}
      ${options.map((option) => {
        const optionValue = option.value ?? option;
        return html`<option value="${optionValue}" ${optionValue === value ? html`selected` : ''}>${option.label ?? option}</option>`;
      })}
    </select>
    ${fieldFooter(id, help)}`;
}

export function textareaField({ id, name = id, label, value = '', help, rows = 3, required = true, placeholder = '' }) {
  return html`
    <label class="form-label" for="${id}">${label}${required ? '' : html` <span class="text-secondary">(optional)</span>`}</label>
    <textarea class="form-control" id="${id}" name="${name}" rows="${rows}" placeholder="${placeholder}"
      ${required ? html`aria-required="true"` : ''} aria-describedby="${describedBy(id, help)}">${value}</textarea>
    ${fieldFooter(id, help)}`;
}

export function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.is-invalid').forEach((control) => {
    control.classList.remove('is-invalid');
    control.removeAttribute('aria-invalid');
  });
  form.querySelectorAll('.invalid-feedback').forEach((node) => {
    node.textContent = '';
  });
}

/** Shows each message beside its field and moves focus to the first one. */
export function showFieldErrors(form, errors = {}) {
  clearFieldErrors(form);
  let first = null;
  Object.entries(errors).forEach(([name, message]) => {
    const control = form.elements[name];
    if (!control) return;
    control.classList.add('is-invalid');
    control.setAttribute('aria-invalid', 'true');
    const errorNode = form.querySelector(`#${control.id}-error`);
    if (errorNode) errorNode.textContent = message;
    first ??= control;
  });
  first?.focus();
  return first !== null;
}
