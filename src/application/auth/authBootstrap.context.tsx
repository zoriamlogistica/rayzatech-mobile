import {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';

type AuthBootstrapContextValue = {
  refreshAfterLogin: () => Promise<void>;
};

const AuthBootstrapContext =
  createContext<AuthBootstrapContextValue | null>(null);

export function AuthBootstrapProvider({
  children,
  refreshAfterLogin,
}: PropsWithChildren<AuthBootstrapContextValue>) {
  return (
    <AuthBootstrapContext.Provider value={{ refreshAfterLogin }}>
      {children}
    </AuthBootstrapContext.Provider>
  );
}

export function useAuthBootstrap() {
  const context = useContext(AuthBootstrapContext);

  if (!context) {
    throw new Error(
      'useAuthBootstrap must be used inside AuthBootstrapProvider'
    );
  }

  return context;
}
