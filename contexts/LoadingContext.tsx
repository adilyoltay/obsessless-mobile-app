import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage?: string;
  setLoading: (loading: boolean, message?: string) => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();

  const setLoading = (loading: boolean, message?: string) => {
    setIsLoading(loading);
    setLoadingMessage(message);
  };

  const showLoading = (message?: string) => {
    setIsLoading(true);
    setLoadingMessage(message || 'Yükleniyor...');
  };

  const hideLoading = () => {
    setIsLoading(false);
    setLoadingMessage(undefined);
  };

  const value: LoadingContextType = {
    isLoading,
    loadingMessage,
    setLoading,
    showLoading,
    hideLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
} 