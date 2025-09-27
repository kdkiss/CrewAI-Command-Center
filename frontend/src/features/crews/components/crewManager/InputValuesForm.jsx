import React, { useCallback } from 'react';

import CrewInputsForm from '../../../../components/CrewInputsForm';
import { useCrewManagerState } from './useCrewManagerState';

const InputValuesForm = ({
  crew,
  hideHeader = false,
  containerClassName,
  contentClassName,
}) => {
  const { getInputValue, updateInputValue } = useCrewManagerState();

  const handleGetValue = useCallback(
    (key) => (typeof getInputValue === 'function' ? getInputValue(key, crew) : ''),
    [getInputValue, crew],
  );

  const handleUpdate = useCallback(
    (key, value, validation) => {
      if (typeof updateInputValue === 'function') {
        updateInputValue(key, value, validation, crew);
      }
    },
    [updateInputValue, crew],
  );

  return (
    <CrewInputsForm
      crew={crew}
      getInputValue={handleGetValue}
      onUpdateInput={handleUpdate}
      hideHeader={hideHeader}
      containerClassName={containerClassName}
      contentClassName={contentClassName}
    />
  );
};

export default InputValuesForm;
