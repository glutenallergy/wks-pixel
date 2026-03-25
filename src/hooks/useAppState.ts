import { useReducer, useRef, useEffect } from 'react';
import type { AppState } from '../state';
import { createDefaultState } from '../state';
import { appReducer, type AppAction } from '../lib/actions';
import { autoSaveState, autoLoadState } from '../presets';

function initState(): AppState {
  const restored = autoLoadState();
  return restored ?? createDefaultState();
}

export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, null, initState);
  const stateRef = useRef<AppState>(state);
  const needsResize = useRef(true);

  // Sync ref on every state change + auto-save
  useEffect(() => {
    stateRef.current = state;
    needsResize.current = true;
    autoSaveState(state);
  }, [state]);

  return { state, dispatch, stateRef, needsResize };
}
