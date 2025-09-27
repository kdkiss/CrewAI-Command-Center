import React, { createContext, useContext } from 'react';
import useCrewManager from '../../state/useCrewManager';
import { API_BASE } from '../../../../config/apiConfig';

const CrewManagerStateContext = createContext(null);

const CrewManagerStateProvider = ({ children, ...options }) => {
  const state = useCrewManager(options);
  const value = { API_BASE, ...state };

  return (
    <CrewManagerStateContext.Provider value={value}>
      {children}
    </CrewManagerStateContext.Provider>
  );
};

const useCrewManagerState = () => {
  const context = useContext(CrewManagerStateContext);
  if (!context) {
    throw new Error('useCrewManagerState must be used within a CrewManagerStateProvider');
  }
  return context;
};

const useCrewFiltersContext = () => {
  const context = useCrewManagerState();
  return context.filters;
};

const useCrewConfigEditorContext = () => {
  const context = useCrewManagerState();
  return context.configEditorState;
};

const useCrewActionsContext = () => {
  const context = useCrewManagerState();
  return context.crewActions;
};

const useCrewToastManager = () => {
  const context = useCrewManagerState();
  return context.toastManager;
};

export {
  CrewManagerStateProvider,
  useCrewManagerState,
  CrewManagerStateContext,
  useCrewFiltersContext,
  useCrewConfigEditorContext,
  useCrewActionsContext,
  useCrewToastManager,
  API_BASE
};
