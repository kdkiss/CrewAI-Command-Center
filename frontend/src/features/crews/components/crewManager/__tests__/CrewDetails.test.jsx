import React from 'react';
import { render, screen } from '@testing-library/react';

import CrewDetails from '../CrewDetails';

jest.mock('../useCrewManagerState', () => ({
  useCrewManagerState: jest.fn(),
  useCrewConfigEditorContext: jest.fn(),
}));

const {
  useCrewManagerState: mockUseCrewManagerState,
  useCrewConfigEditorContext: mockUseCrewConfigEditorContext,
} = jest.requireMock('../useCrewManagerState');

const mockCrewList = jest.fn();
const mockConfigEditor = jest.fn();

jest.mock('../CrewList', () => ({
  __esModule: true,
  default: (props) => {
    mockCrewList(props);
    return <div data-testid="crew-list" />;
  },
}));

jest.mock('../../../../../components/ConfigEditor', () => ({
  __esModule: true,
  default: (props) => {
    mockConfigEditor(props);
    return <div data-testid="config-editor" />;
  },
}));

const createManagerState = (overrides = {}) => ({
  selectedCrew: null,
  ...overrides,
});

const createConfigState = (overrides = {}) => ({
  editorTarget: null,
  editorContent: '',
  setEditorContent: jest.fn(),
  saveEditorContent: jest.fn(),
  closeEditor: jest.fn(),
  savingFile: false,
  saveSuccess: false,
  saveError: null,
  editorLoading: false,
  editorStorageKey: null,
  clearAutosavedDrafts: jest.fn(),
  ...overrides,
});

describe('CrewDetails', () => {
  beforeEach(() => {
    mockCrewList.mockClear();
    mockConfigEditor.mockClear();
    mockUseCrewManagerState.mockReset();
    mockUseCrewConfigEditorContext.mockReset();
  });

  it('renders the crew list when no editor target is active', () => {
    const onSelectCrew = jest.fn();
    const setCrewListPreferences = jest.fn();

    mockUseCrewManagerState.mockReturnValue(createManagerState());
    mockUseCrewConfigEditorContext.mockReturnValue(createConfigState());

    render(
      <CrewDetails
        setCrewListPreferences={setCrewListPreferences}
        onSelectCrew={onSelectCrew}
      />
    );

    expect(screen.getByTestId('crew-list')).toBeInTheDocument();
    expect(mockCrewList).toHaveBeenCalledWith(expect.objectContaining({
      setCrewListPreferences,
      onSelectCrew,
    }));
  });

  it('renders the configuration editor when an editor target is provided', () => {
    const configState = createConfigState({
      editorTarget: { path: 'crews/example.yaml' },
      editorContent: 'content',
      savingFile: true,
      saveSuccess: true,
      saveError: 'error',
      editorLoading: true,
      editorStorageKey: 'storage-key',
    });

    mockUseCrewManagerState.mockReturnValue(createManagerState());
    mockUseCrewConfigEditorContext.mockReturnValue(configState);

    render(<CrewDetails view="config" />);

    expect(screen.getByTestId('config-editor')).toBeInTheDocument();
    expect(mockConfigEditor).toHaveBeenCalledWith(expect.objectContaining({
      target: configState.editorTarget,
      content: configState.editorContent,
      isSaving: configState.savingFile,
      saveSucceeded: configState.saveSuccess,
      saveError: configState.saveError,
      isLoading: configState.editorLoading,
      storageKey: configState.editorStorageKey,
    }));
  });

  it('shows the placeholder message when no crew is selected in config view', () => {
    mockUseCrewManagerState.mockReturnValue(createManagerState());
    mockUseCrewConfigEditorContext.mockReturnValue(createConfigState());

    render(<CrewDetails view="config" />);

    expect(screen.getByText(/Select a crew to get started/i)).toBeInTheDocument();
    expect(screen.getByText(/Select a crew before editing configuration files/i)).toBeInTheDocument();
  });
});
