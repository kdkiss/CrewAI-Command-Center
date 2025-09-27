import React, { useCallback, useMemo, useState } from 'react';

const useConfirmDialog = ({ crews, stopCrew, deleteCrew, addToast, setSelectedCrew }) => {
  const [state, setState] = useState(null);

  const resolveCrewDetails = useCallback((crewId) => {
    if (!crewId) {
      return { id: '', name: '' };
    }

    const stringCrewId = String(crewId);
    const crew = crews.find(item => String(item?.id ?? '') === stringCrewId);
    const crewName = crew?.name || crew?.id || stringCrewId;

    return { id: stringCrewId, name: crewName };
  }, [crews]);

  const requestStopCrew = useCallback((crewId) => {
    if (!crewId) {
      return;
    }

    const { id, name } = resolveCrewDetails(crewId);

    if (!id) {
      return;
    }

    setState({
      type: 'stop-crew',
      crewId: id,
      title: 'Stop Crew',
      body: `Are you sure you want to stop "${name}"? This will end the current run.`,
      confirmLabel: 'Stop Crew',
      cancelLabel: 'Keep Running',
      isProcessing: false,
      error: null
    });
  }, [resolveCrewDetails]);

  const requestDeleteCrew = useCallback((crewId) => {
    if (!crewId) {
      return;
    }

    const { id, name } = resolveCrewDetails(crewId);

    if (!id) {
      return;
    }

    setState({
      type: 'delete-crew',
      crewId: id,
      crewName: name,
      title: 'Delete Crew',
      body: `Delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Crew',
      cancelLabel: 'Cancel',
      isProcessing: false,
      error: null
    });
  }, [resolveCrewDetails]);

  const handleCancel = useCallback(() => {
    setState(current => {
      if (current?.isProcessing) {
        return current;
      }

      return null;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const currentState = state;

    if (!currentState || currentState.isProcessing) {
      return;
    }

    if (currentState.type === 'stop-crew' && currentState.crewId) {
      stopCrew(currentState.crewId);
      setState(null);
      return;
    }

    if (currentState.type === 'delete-crew' && currentState.crewId) {
      setState(prev => (prev ? { ...prev, isProcessing: true, error: null } : prev));

      try {
        await deleteCrew(currentState.crewId);
        setSelectedCrew(prev => (prev && String(prev.id) === currentState.crewId ? null : prev));

        const crewName = currentState.crewName || currentState.crewId;
        addToast({
          title: 'Crew Deleted',
          message: `${crewName} deleted successfully.`,
          type: 'success'
        });

        setState(null);
      } catch (error) {
        const message = error?.response?.data?.detail || error.message || 'Failed to delete crew.';
        addToast({
          title: 'Delete Failed',
          message,
          type: 'error'
        });

        setState(prev => (prev ? { ...prev, isProcessing: false, error: message } : prev));
      }

      return;
    }

    setState(null);
  }, [state, stopCrew, deleteCrew, addToast, setSelectedCrew]);

  const body = useMemo(() => {
    if (!state) {
      return null;
    }

    const { body: description, error } = state;

    if (error) {
      return (
        <div className="space-y-3">
          {description ? <p>{description}</p> : null}
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      );
    }

    return description || null;
  }, [state]);

  return {
    state,
    body,
    requestStopCrew,
    requestDeleteCrew,
    handleConfirm,
    handleCancel,
  };
};

export default useConfirmDialog;
