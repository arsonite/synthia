/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Generic context factory. Creates a Provider plus a typed hook from an
 * initial state object, so global and feature contexts stay declarative.
 */

// React imports
import { createContext, ReactNode, useContext, useState } from 'react';

// Utility type to infer state based on a given type
type ContextType<T> = {
    [K in keyof T]: [T[K], React.Dispatch<React.SetStateAction<T[K]>>];
};

// Create a higher-order function that creates a Context and Provider dynamically from the type
const createContextProvider = <T extends Record<string, unknown>>(initialState: T) => {
    // Create the context for the type
    const Context = createContext<ContextType<T> | undefined>(undefined);

    // The provider component that will manage and provide state for the context
    const Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
        // Initialize state for each key in initialState
        const state: ContextType<T> = Object.keys(initialState).reduce((acc, key) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            acc[key as keyof T] = useState<T[keyof T]>(initialState[key as keyof T]);
            return acc;
        }, {} as ContextType<T>);

        return <Context.Provider value={state}>{children}</Context.Provider>;
    };

    // A custom hook to access the context
    const useCustomContext = (): ContextType<T> => {
        const context = useContext(Context);
        if (!context) {
            throw new Error('useContext hook must be used within a Context Provider');
        }
        return context;
    };

    return { Provider, useCustomContext };
};

export default createContextProvider;
