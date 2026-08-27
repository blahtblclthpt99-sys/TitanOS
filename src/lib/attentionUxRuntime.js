const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusable(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter((el) => {
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && !el.hasAttribute('inert');
  });
}

function enhanceNotice(node) {
  if (!(node instanceof HTMLElement) || !node.classList.contains('notice')) return;
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-atomic', 'true');
}

function enhanceProgress(node) {
  if (!(node instanceof HTMLElement) || !node.classList.contains('progress')) return;
  if (!node.closest('.watch-modal')) return;
  const bar = node.querySelector(':scope > span');
  if (!bar) return;
  const percent = Math.max(0, Math.min(100, Number.parseFloat(bar.style.width) || 0));
  node.setAttribute('role', 'progressbar');
  node.setAttribute('aria-label', 'Verified active-time progress');
  node.setAttribute('aria-valuemin', '0');
  node.setAttribute('aria-valuemax', '100');
  node.setAttribute('aria-valuenow', String(Math.round(percent)));
}

function enhanceDisabledGuidance(root = document) {
  root.querySelectorAll('button').forEach((button) => {
    if (button.textContent?.trim() !== 'Request payout') return;
    if (button.disabled) {
      const guidance = 'A minimum available balance of $5.00 is required to request a payout.';
      button.title = guidance;
      button.setAttribute('aria-description', guidance);
    } else {
      button.removeAttribute('title');
      button.removeAttribute('aria-description');
    }
  });
}

export function installAttentionUxRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let activeDialog = null;
  let restoreTarget = null;
  let observer;
  let syncFrame = 0;

  const sync = () => {
    syncFrame = 0;
    document.querySelectorAll('.notice').forEach(enhanceNotice);
    document.querySelectorAll('.progress').forEach(enhanceProgress);
    enhanceDisabledGuidance();

    const dialog = document.querySelector('.modal-backdrop .auth-modal, .modal-backdrop .watch-modal');
    if (dialog && dialog !== activeDialog) {
      restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      activeDialog = dialog;
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const heading = dialog.querySelector('h1, h2, h3');
      if (heading) {
        if (!heading.id) heading.id = `attention-dialog-${Math.random().toString(36).slice(2, 9)}`;
        dialog.setAttribute('aria-labelledby', heading.id);
      } else {
        dialog.setAttribute('aria-label', 'Dialog');
      }
      dialog.querySelectorAll('.close').forEach((button) => {
        if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Close dialog');
      });
      document.documentElement.classList.add('modal-open');
      window.requestAnimationFrame(() => {
        const first = visibleFocusable(dialog)[0];
        if (first) first.focus({ preventScroll: true });
        else {
          dialog.tabIndex = -1;
          dialog.focus({ preventScroll: true });
        }
      });
    } else if (!dialog && activeDialog) {
      activeDialog = null;
      document.documentElement.classList.remove('modal-open');
      if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });
      restoreTarget = null;
    }
  };

  const scheduleSync = () => {
    if (syncFrame) return;
    syncFrame = window.requestAnimationFrame(sync);
  };

  const onKeyDown = (event) => {
    if (!activeDialog) return;

    if (event.key === 'Escape') {
      const close = activeDialog.querySelector('.close');
      if (close instanceof HTMLElement) {
        event.preventDefault();
        close.click();
      }
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = visibleFocusable(activeDialog);
    if (!focusable.length) {
      event.preventDefault();
      activeDialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', onKeyDown, true);
  observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled', 'style'],
  });
  sync();

  return () => {
    observer?.disconnect();
    if (syncFrame) window.cancelAnimationFrame(syncFrame);
    document.removeEventListener('keydown', onKeyDown, true);
    document.documentElement.classList.remove('modal-open');
  };
}
