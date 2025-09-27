import { useEffect } from 'react';

const FOCUSABLE_SELECTORS =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const useSidebarFocusTrap = ({ isActive, containerRef, onClose }) => {
  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    if (typeof document === 'undefined') {
      return undefined;
    }

    const node = containerRef?.current;

    if (!node) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;

    const focusFirstElement = () => {
      const focusableElements = node.querySelectorAll(FOCUSABLE_SELECTORS);
      if (focusableElements.length > 0) {
        const first = focusableElements[0];
        if (first instanceof HTMLElement) {
          first.focus();
          return;
        }
      }

      if (node instanceof HTMLElement) {
        node.focus();
      }
    };

    focusFirstElement();

    const handleKeyDown = (event) => {
      if (!node) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = node.querySelectorAll(FOCUSABLE_SELECTORS);

      if (focusableElements.length === 0) {
        event.preventDefault();
        if (node instanceof HTMLElement) {
          node.focus();
        }
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
        return;
      }

      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !node.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocus = (event) => {
      if (!node || !isActive) {
        return;
      }

      if (node.contains(event.target)) {
        return;
      }

      event.stopPropagation();
      focusFirstElement();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focus', handleFocus, true);

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [isActive, containerRef, onClose]);
};

export default useSidebarFocusTrap;
