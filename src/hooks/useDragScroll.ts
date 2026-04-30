import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook to enable click-and-drag scrolling on a container.
 */
export const useDragScroll = (externalRef?: React.RefObject<HTMLDivElement>) => {
  const localRef = useRef<HTMLDivElement>(null);
  const ref = externalRef || localRef;
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    
    // Ignore if clicking interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, .no-drag')) {
      return;
    }

    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setStartY(e.pageY - ref.current.offsetTop);
    setScrollLeft(ref.current.scrollLeft);
    setScrollTop(ref.current.scrollTop);
    
    ref.current.style.cursor = 'grabbing';
    ref.current.style.userSelect = 'none';
  }, []);

  const onMouseLeave = useCallback(() => {
    setIsDragging(false);
    if (ref.current) {
      ref.current.style.cursor = '';
      ref.current.style.userSelect = '';
    }
  }, []);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    if (ref.current) {
      ref.current.style.cursor = '';
      ref.current.style.userSelect = '';
    }
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !ref.current) return;
    
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const y = e.pageY - ref.current.offsetTop;
    
    const walkX = (x - startX) * 2; // Scroll speed factor
    const walkY = (y - startY) * 2;
    
    ref.current.scrollLeft = scrollLeft - walkX;
    ref.current.scrollTop = scrollTop - walkY;
  }, [isDragging, startX, startY, scrollLeft, scrollTop]);

  // Global mouse up to handle release outside the container
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        if (ref.current) {
          ref.current.style.cursor = '';
          ref.current.style.userSelect = '';
        }
      };
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  return { 
    ref, 
    onMouseDown, 
    onMouseMove, 
    onMouseUp,
    onMouseLeave,
    isDragging 
  };
};
