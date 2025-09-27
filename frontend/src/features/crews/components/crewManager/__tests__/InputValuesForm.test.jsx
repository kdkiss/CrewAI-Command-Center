import React from 'react';
import { render } from '@testing-library/react';

import InputValuesForm from '../InputValuesForm';

jest.mock('../useCrewManagerState', () => ({
  useCrewManagerState: jest.fn(),
}));

const { useCrewManagerState: mockUseCrewManagerState } = jest.requireMock('../useCrewManagerState');

const mockCrewInputsForm = jest.fn();

jest.mock('../../../../../components/CrewInputsForm', () => ({
  __esModule: true,
  default: (props) => {
    mockCrewInputsForm(props);
    return null;
  },
}));

describe('InputValuesForm', () => {
  beforeEach(() => {
    mockCrewInputsForm.mockClear();
    mockUseCrewManagerState.mockReset();
  });

  it('wires context helpers into CrewInputsForm', () => {
    const crew = { id: '42' };
    const getInputValue = jest.fn().mockReturnValue('hello');
    const updateInputValue = jest.fn();

    mockUseCrewManagerState.mockReturnValue({ getInputValue, updateInputValue });

    render(
      <InputValuesForm
        crew={crew}
        hideHeader
        containerClassName="outer"
        contentClassName="inner"
      />
    );

    expect(mockCrewInputsForm).toHaveBeenCalledWith(expect.objectContaining({
      crew,
      hideHeader: true,
      containerClassName: 'outer',
      contentClassName: 'inner',
    }));

    const props = mockCrewInputsForm.mock.calls[0][0];
    expect(props.getInputValue('topic')).toBe('hello');
    expect(getInputValue).toHaveBeenCalledWith('topic', crew);

    props.onUpdateInput('topic', 'updated', { valid: true });
    expect(updateInputValue).toHaveBeenCalledWith('topic', 'updated', { valid: true }, crew);
  });
});
