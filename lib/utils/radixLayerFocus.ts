/**
 * Radix layers (Dialog, Sheet, Select, etc.) set aria-hidden on background content.
 * Blur focused elements outside the layer to avoid browser a11y warnings.
 */
export function blurActiveElementOutside(contentSelector: string): void {
  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body) return;
  if (active.closest(contentSelector)) return;
  active.blur();
}

type LayerFocusEvent = { preventDefault: () => void };

export function createRadixLayerFocusHandlers(contentSelector: string) {
  let previousActiveElement: HTMLElement | null = null;

  return {
    onOpenAutoFocus: (event: LayerFocusEvent) => {
      const active = document.activeElement as HTMLElement | null;

      if (active && !active.closest(contentSelector)) {
        previousActiveElement = active;
        setTimeout(() => blurActiveElementOutside(contentSelector), 0);
      }

      if (
        active &&
        (active.closest(contentSelector) ||
          active.tagName === "BUTTON" ||
          active.closest("script"))
      ) {
        event.preventDefault();
      }
    },
    onCloseAutoFocus: (event: LayerFocusEvent) => {
      if (previousActiveElement) {
        event.preventDefault();
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    },
  };
}

/** Blur page focus when a Radix Select opens (Select has no onOpenAutoFocus). */
export function blurBackgroundForSelectOpen(): void {
  blurActiveElementOutside(
    "[data-radix-select-content], [data-radix-select-trigger]"
  );
}

/** Close a popover/dropdown, blur focus, then run an action on the next frame. */
export function deferAfterOverlayClose(
  close: () => void,
  action: () => void
): void {
  blurActiveElementOutside("[data-radix-popper-content-wrapper]");
  close();
  requestAnimationFrame(action);
}
