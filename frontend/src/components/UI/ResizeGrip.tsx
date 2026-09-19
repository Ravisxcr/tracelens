import React, { useState, useCallback, useRef } from 'react';

interface ResizeGripProps {
  initialWidth: number;
  direction?: 'left' | 'right';
  minWidth?: number;
  maxWidth?: number;
  onResize: (width: number) => void;
  onResizeEnd?: (width: number) => void;
}

export const ResizeGrip: React.FC<ResizeGripProps> = ({
  initialWidth,
  direction = 'right',
  minWidth = 160,
  maxWidth = 1200,
  onResize,
  onResizeEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startWidthRef = useRef(initialWidth);
  const startXRef = useRef(0);
  const latestWidthRef = useRef(initialWidth);
  const rafRef = useRef<number | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startWidthRef.current = initialWidth;
      latestWidthRef.current = initialWidth;
      setIsDragging(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current;
        const rawWidth =
          direction === 'right'
            ? startWidthRef.current + deltaX
            : startWidthRef.current - deltaX;

        const clamped = Math.max(minWidth, Math.min(maxWidth, rawWidth));
        latestWidthRef.current = clamped;

        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
          onResize(clamped);
          rafRef.current = null;
        });
      };

      const handleMouseUp = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        setIsDragging(false);
        const finalWidth = latestWidthRef.current;
        onResize(finalWidth);

        if (onResizeEnd) {
          onResizeEnd(finalWidth);
        }

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      window.addEventListener('mouseup', handleMouseUp);
    },
    [direction, initialWidth, minWidth, maxWidth, onResize, onResizeEnd]
  );

  return (
    <>
      {/* Full-screen capture overlay during dragging to prevent Monaco/ReactFlow from stealing pointer events */}
      {isDragging && (
        <div
          className="fixed inset-0 z-[9999] cursor-col-resize select-none bg-transparent"
          style={{ pointerEvents: 'all' }}
        />
      )}

      <div
        onMouseDown={handleMouseDown}
        className={`group relative w-1 hover:w-1.5 active:w-1.5 -mx-0.5 z-30 cursor-col-resize shrink-0 select-none flex items-center justify-center transition-none ${
          isDragging ? 'w-1.5 bg-blue-500' : ''
        }`}
        title="Drag to resize panel"
      >
        <div
          className={`w-full h-full transition-colors ${
            isDragging
              ? 'bg-blue-600 dark:bg-blue-500'
              : 'bg-transparent group-hover:bg-blue-500/80 group-active:bg-blue-600'
          }`}
        />
      </div>
    </>
  );
};
