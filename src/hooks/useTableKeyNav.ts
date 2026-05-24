import { useState, useEffect, useCallback } from 'react';

interface UseTableKeyNavProps {
  items: any[];
  onEnter?: (index: number) => void;
  onDelete?: (index: number) => void;
}

export function useTableKeyNav({ items, onEnter, onDelete }: UseTableKeyNavProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const scrollIntoView = useCallback((index: number) => {
    if (index < 0) return;
    // Small delay to ensure DOM is updated if needed
    setTimeout(() => {
      const element = document.querySelector(`[data-row-index="${index}"]`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (items.length === 0) return;

      // Ignore if typing in an input, textarea or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = Math.min(prev + 1, items.length - 1);
            scrollIntoView(next);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            scrollIntoView(next);
            return next;
          });
          break;
        case 'Home':
          e.preventDefault();
          setSelectedIndex(0);
          scrollIntoView(0);
          break;
        case 'End':
          e.preventDefault();
          const last = items.length - 1;
          setSelectedIndex(last);
          scrollIntoView(last);
          break;
        case 'Enter':
          if (selectedIndex >= 0 && onEnter) {
            onEnter(selectedIndex);
          }
          break;
        case 'Delete':
          if (selectedIndex >= 0 && onDelete) {
            onDelete(selectedIndex);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, selectedIndex, onEnter, onDelete, scrollIntoView]);

  // Reset selection if items change and selection is out of bounds
  useEffect(() => {
    if (items.length === 0) {
      setSelectedIndex(-1);
    } else if (selectedIndex >= items.length) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length]);

  return { selectedIndex, setSelectedIndex };
}
