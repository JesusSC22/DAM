/**
 * Utilidades para mejorar la accesibilidad
 */

/**
 * Anuncia un mensaje a los lectores de pantalla
 * 
 * @param message - El mensaje a anunciar
 * @param priority - La prioridad del anuncio ('polite' o 'assertive')
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remover después de que el lector de pantalla lo haya leído
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Obtiene el siguiente elemento enfocable en el DOM
 * 
 * @param currentElement - El elemento actualmente enfocado
 * @param direction - La dirección de navegación ('forward' o 'backward')
 * @returns El siguiente elemento enfocable o null
 */
export function getNextFocusableElement(
  currentElement: HTMLElement,
  direction: 'forward' | 'backward' = 'forward'
): HTMLElement | null {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  const focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(focusableSelectors)
  ).filter(
    (el) =>
      el.offsetWidth > 0 &&
      el.offsetHeight > 0 &&
      !el.hasAttribute('hidden') &&
      window.getComputedStyle(el).visibility !== 'hidden'
  );

  const currentIndex = focusableElements.indexOf(currentElement);

  if (direction === 'forward') {
    return focusableElements[currentIndex + 1] || focusableElements[0] || null;
  } else {
    return (
      focusableElements[currentIndex - 1] ||
      focusableElements[focusableElements.length - 1] ||
      null
    );
  }
}

/**
 * Enfoca el siguiente elemento enfocable
 * 
 * @param currentElement - El elemento actualmente enfocado
 * @param direction - La dirección de navegación
 */
export function focusNextElement(
  currentElement: HTMLElement,
  direction: 'forward' | 'backward' = 'forward'
): void {
  const nextElement = getNextFocusableElement(currentElement, direction);
  if (nextElement) {
    nextElement.focus();
  }
}

/**
 * Verifica si un elemento está visible en el viewport
 * 
 * @param element - El elemento a verificar
 * @returns true si el elemento está visible
 */
export function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Hace scroll a un elemento si no está visible
 * 
 * @param element - El elemento al que hacer scroll
 * @param behavior - El comportamiento del scroll ('smooth' o 'auto')
 */
export function scrollToElement(
  element: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (!isElementVisible(element)) {
    element.scrollIntoView({
      behavior,
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

