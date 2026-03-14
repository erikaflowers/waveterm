/**
 * App State Management
 * Lightweight state management using React Context + useReducer.
 * Use this pattern for state that needs to be shared across components.
 */

import { createContext, useContext, useReducer } from 'react';

// Initial state
const initialState = {
  theme: 'dark',
};

// Actions
const actions = {
  SET_THEME: 'SET_THEME',
  TOGGLE_THEME: 'TOGGLE_THEME',
};

// Reducer — pure function, no side effects
function appReducer(state, action) {
  switch (action.type) {
    case actions.SET_THEME:
      return { ...state, theme: action.payload };
    case actions.TOGGLE_THEME:
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    default:
      return state;
  }
}

// Context
const AppContext = createContext(null);
const AppDispatchContext = createContext(null);

// Provider component — wrap your app with this
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppContext.Provider>
  );
}

// Hooks for consuming state and dispatch
export function useAppState() {
  const context = useContext(AppContext);
  if (context === null) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (context === null) {
    throw new Error('useAppDispatch must be used within an AppProvider');
  }
  return context;
}

export { actions };
