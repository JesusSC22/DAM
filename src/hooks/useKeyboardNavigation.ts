import { useEffect, useCallback } from 'react';

/**
 * Hook para manejar navegación por teclado
 * 
 * Proporciona atajos de teclado comunes para mejorar la accesibilidad
 * 
 * @param handlers - Objeto con handlers para diferentes teclas
 * 
 * @example
 * ```tsx
 * useKeyboardNavigation({
 *   onEscape: () => closeModal(),
 *   onEnter: () => submitForm(),
 *   onArrowUp: () => selectPrevious(),
 *   onArrowDown: () => selectNext(),
 * });
 * ```
 */
export function useKeyboardNavigation(handlers: {
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  onCtrlK?: () => void; // Búsqueda rápida
  onCtrlS?: () => void; // Guardar
  enabled?: boolean;
}) {
  const {
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onTab,
    onShiftTab,
    onCtrlK,
    onCtrlS,
    enabled = true,
  } = handlers;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignorar si el usuario está escribiendo en un input, textarea o contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Permitir Escape y Ctrl+K incluso cuando se está escribiendo
        if (event.key === 'Escape' && onEscape) {
          event.preventDefault();
          onEscape();
          return;
        }
        if (event.key === 'k' && (event.ctrlKey || event.metaKey) && onCtrlK) {
          event.preventDefault();
          onCtrlK();
          return;
        }
        return;
      }

      switch (event.key) {
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter();
          }
          break;
        case 'ArrowUp':
          if (onArrowUp) {
            event.preventDefault();
            onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (onArrowDown) {
            event.preventDefault();
            onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (onArrowRight) {
            event.preventDefault();
            onArrowRight();
          }
          break;
        case 'Tab':
          if (event.shiftKey && onShiftTab) {
            event.preventDefault();
            onShiftTab();
          } else if (onTab) {
            event.preventDefault();
            onTab();
          }
          break;
        case 'k':
          if ((event.ctrlKey || event.metaKey) && onCtrlK) {
            event.preventDefault();
            onCtrlK();
          }
          break;
        case 's':
          if ((event.ctrlKey || event.metaKey) && onCtrlS) {
            event.preventDefault();
            onCtrlS();
          }
          break;
      }
    },
    [
      enabled,
      onEscape,
      onEnter,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onTab,
      onShiftTab,
      onCtrlK,
      onCtrlS,
    ]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [enabled, handleKeyDown]);
}

