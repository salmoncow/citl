/**
 * Dialog helpers for the spec 009 League section: a form dialog and a
 * confirm dialog, both native <dialog> (focus trap, Escape closes) in the
 * spec 008 pattern. Focus returns to the trigger on close.
 */

let idCounter = 0;

export interface FormDialogOptions {
  title: string;
  /** Trusted markup for the form fields; callers escape user values. */
  fieldsHtml: string;
  submitLabel: string;
  /** Return an error message to keep the dialog open, or null to close it. */
  onSubmit: (form: HTMLFormElement) => Promise<string | null>;
  /** Runs once the fields are in the DOM (wire extra listeners here). */
  onOpen?: (form: HTMLFormElement) => void;
}

function openShell(titleText: string): { dialog: HTMLDialogElement; id: string; done: Promise<void> } {
  const id = `ld-${++idCounter}`;
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement('dialog');
  dialog.className = 'confirm-dialog league-dialog';
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const title = document.createElement('h2');
  title.id = `${id}-title`;
  title.className = 'league-dialog__title';
  title.textContent = titleText;
  dialog.appendChild(title);
  const done = new Promise<void>((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (trigger?.isConnected) trigger.focus();
      resolve();
    });
  });
  return { dialog, id, done };
}

/** Resolves true when the form was submitted successfully. */
export function openFormDialog(opts: FormDialogOptions): Promise<boolean> {
  const { dialog, id, done } = openShell(opts.title);
  const form = document.createElement('form');
  form.className = 'account-form';
  form.noValidate = true;
  form.innerHTML = `
    ${opts.fieldsHtml}
    <p id="${id}-error" class="account-field__error" role="alert" hidden></p>
    <div class="confirm-dialog__actions">
      <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" class="btn-primary">${opts.submitLabel}</button>
    </div>`;
  dialog.appendChild(form);

  let submitted = false;
  const error = form.querySelector<HTMLElement>(`#${id}-error`)!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  form.querySelector('[data-action="cancel"]')?.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    void opts.onSubmit(form).then((msg) => {
      submit.disabled = false;
      if (msg) {
        error.textContent = msg;
        error.hidden = false;
        return;
      }
      submitted = true;
      dialog.close();
    });
  });

  document.body.appendChild(dialog);
  opts.onOpen?.(form);
  dialog.showModal();
  form.querySelector<HTMLElement>('input, select, textarea')?.focus();
  return done.then(() => submitted);
}

/** Confirm dialog; focus starts on Cancel. Resolves true on confirm. */
export function confirmLeague(title: string, body: string, confirmLabel: string, danger = false): Promise<boolean> {
  const { dialog, done } = openShell(title);
  const p = document.createElement('p');
  p.className = 'account-confirm__body';
  p.textContent = body;
  const actions = document.createElement('div');
  actions.className = 'confirm-dialog__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-secondary';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = danger ? 'btn-danger' : 'btn-primary';
  confirm.textContent = confirmLabel;
  actions.append(cancel, confirm);
  let ok = false;
  cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', () => { ok = true; dialog.close(); });
  dialog.append(p, actions);
  document.body.appendChild(dialog);
  dialog.showModal();
  cancel.focus();
  return done.then(() => ok);
}
