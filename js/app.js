// Edge · gemeinsame Registry: Ansichten melden hier ihre Klick-, Eingabe- und Änderungs-Handler an.
export const actions = Object.create(null);
export const inputs = Object.create(null);
export const changes = Object.create(null);

export const act = (name, fn) => {
  actions[name] = fn;
};
export const onInput = (name, fn) => {
  inputs[name] = fn;
};
export const onChange = (name, fn) => {
  changes[name] = fn;
};

// Navigation wird von main.js gesetzt; so vermeiden die Ansichten zirkuläre Importe.
export const app = {
  go: () => {},
  refresh: () => {},
  current: () => 'today',
};
