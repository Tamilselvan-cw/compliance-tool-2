import React from "react";

type Session = {
  accessToken: string | null;
  user: { id: string; email: string; role: string } | null;
  permissions: string[];
};

type AuthContextType = {
  session: Session;
  setAuth: (s: Session) => void;
  clearAuth: () => void;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = React.useState<Session>({
    accessToken: null,
    user: null,
    permissions: [],
  });

  const setAuth = (s: Session) => setSession(s);
  const clearAuth = () =>
    setSession({ accessToken: null, user: null, permissions: [] });

  return (
    <AuthContext.Provider value={{ session, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
