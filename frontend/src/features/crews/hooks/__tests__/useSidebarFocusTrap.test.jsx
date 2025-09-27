import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import useSidebarFocusTrap from '../useSidebarFocusTrap';

const FocusTrapTest = ({ active, onClose }) => {
  const containerRef = React.useRef(null);
  useSidebarFocusTrap({ isActive: active, containerRef, onClose });

  return (
    <div>
      <button type="button" data-testid="outside">
        Outside
      </button>
      <div ref={containerRef} tabIndex={-1}>
        <button type="button" data-testid="first">
          First
        </button>
        <button type="button" data-testid="last">
          Last
        </button>
      </div>
    </div>
  );
};

describe('useSidebarFocusTrap', () => {
  it('invokes onClose when escape is pressed while active', () => {
    const onClose = jest.fn();
    const { rerender } = render(<FocusTrapTest active={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    rerender(<FocusTrapTest active onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('recycles focus within the container when tabbing', () => {
    const { getByTestId } = render(<FocusTrapTest active onClose={jest.fn()} />);

    const first = getByTestId('first');
    const last = getByTestId('last');

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });
});
