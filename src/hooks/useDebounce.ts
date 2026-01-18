import { useState, useEffect } from 'react';

/**
 * Hook personalizado para debounce de valores
 * 
 * Útil para optimizar búsquedas y otras operaciones que no necesitan ejecutarse
 * en cada cambio de input.
 * 
 * @param value - El valor a debounce
 * @param delay - El delay en milisegundos (por defecto 300ms)
 * @returns El valor debounced
 * 
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 500);
 * 
 * useEffect(() => {
 *   // Esta función solo se ejecuta después de 500ms sin cambios
 *   performSearch(debouncedQuery);
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Establecer un timer para actualizar el valor debounced después del delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpiar el timer si el valor cambia antes del delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

