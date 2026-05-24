import React, { useState, useEffect, useCallback } from 'react';

interface UseKeyboardNavigationProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function useKeyboardNavigation<T>({
  items,
  onSelect,
  isOpen,
  setIsOpen
}: UseKeyboardNavigationProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(-1);
    } else if (items.length > 0 && selectedIndex === -1) {
      setSelectedIndex(0);
    }
  }, [isOpen, items.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        // Allow tab to move to next field, but maybe select highlighted item?
        // Usually Tab should just move focus. If we want to select on Tab, we can add it here.
        break;
    }
  }, [isOpen, items, selectedIndex, onSelect, setIsOpen]);

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown
  };
}
