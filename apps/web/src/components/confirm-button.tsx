'use client';

// ConfirmButton — destructive actions need a confirmation step.
//
// Plain English: replaces a one-click delete/void button with a two-
// step ("are you sure?") flow. Wraps a form so the actual mutation
// still happens via a server action.

import { useState, type FormEvent } from 'react';

import { Button } from './button';
import { Modal } from './modal';
import { useTranslator } from '../lib/use-translator';

interface Props {
  /** What the user clicks. Defaults to 'Delete'. */
  label?: string;
  /** Confirm headline. */
  title: string;
  /** Confirm body — explain the consequence. */
  body: React.ReactNode;
  /** Confirm button label inside the modal. Defaults to 'Yes, do it'. */
  confirmLabel?: string;
  /** Submit form action — typically a server action. */
  action: (formData: FormData) => void | Promise<void>;
  /** Optional hidden form fields (e.g. record id). */
  hiddenFields?: Record<string, string>;
  /** 'danger' (red) or 'warn' (amber). Default danger. */
  variant?: 'danger' | 'warn';
  /** sm / md / lg button size. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
}

export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  action,
  hiddenFields,
  variant = 'danger',
  size = 'md',
}: Props) {
  const t = useTranslator();
  const resolvedLabel = label ?? t('confirmButton.defaultLabel');
  const resolvedConfirm = confirmLabel ?? t('confirmButton.defaultConfirm');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    try {
      await action(fd);
    } finally {
      setPending(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant === 'danger' ? 'danger' : 'secondary'}
        size={size}
        onClick={() => setOpen(true)}
      >
        {resolvedLabel}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)} disabled={pending}>
              {t('confirmButton.cancel')}
            </Button>
            <Button
              type="submit"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="md"
              disabled={pending}
              onClick={() => {
                const f = document.querySelector<HTMLFormElement>('form#confirm-form');
                f?.requestSubmit();
              }}
            >
              {pending ? t('confirmButton.busy') : resolvedConfirm}
            </Button>
          </>
        }
      >
        <form id="confirm-form" onSubmit={onSubmit}>
          {hiddenFields
            ? Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
            : null}
          <div>{body}</div>
        </form>
      </Modal>
    </>
  );
}
