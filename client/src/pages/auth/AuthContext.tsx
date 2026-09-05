import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, LoginRequest, DemoAccount, DEMO_ACCOUNTS } from "./types";
import { loginUser, fetchCurrentUser, getAuthToken, clearAuthToken, getStoredUser, setStoredUser, seedDefaultUsers } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole;
  login: (credentials: LoginRequest) => Promise<void>;
  quickDemoLogin: (account: DemoAccount) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getAuthToken());
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getAuthToken();
      if (storedToken) {
        try {
          const fetchedUser = await fetchCurrentUser();
          setUser(fetchedUser);
          setStoredUser(fetchedUser);
          setToken(storedToken);
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const authData = await loginUser(credentials);
      setToken(authData.access_token);
      setUser(authData.user);
      setIsLoginModalOpen(false);
    } catch (err) {
      // If demo accounts not yet seeded in fresh DB, seed and retry once
      try {
        await seedDefaultUsers();
        const authData = await loginUser(credentials);
        setToken(authData.access_token);
        setUser(authData.user);
        setIsLoginModalOpen(false);
      } catch {
        throw err;
      }
    }
  };

  const quickDemoLogin = async (account: DemoAccount) => {
    await login({ email: account.email, password: account.password });
  };

  const logout = () => {
    clearAuthToken();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      const fetchedUser = await fetchCurrentUser();
      setUser(fetchedUser);
      setStoredUser(fetchedUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        role: user?.role || "employee",
        login,
        quickDemoLogin,
        logout,
        refreshUser,
        isLoginModalOpen,
        openLoginModal: () => setIsLoginModalOpen(true),
        closeLoginModal: () => setIsLoginModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
