import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, LoginRequest } from "./types";
import { loginUser, fetchCurrentUser, getAuthToken, clearAuthToken, getStoredUser, setStoredUser } from "./api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  role: UserRole;
  login: (credentials: LoginRequest) => Promise<void>;
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchCurrentUser()
        .then((fetchedUser) => {
          setUser(fetchedUser);
          setStoredUser(fetchedUser);
        })
        .catch(() => {
          logout();
        });
    }
  }, [token]);

  const login = async (credentials: LoginRequest) => {
    const authData = await loginUser(credentials);
    setToken(authData.access_token);
    setUser(authData.user);
    setIsLoginModalOpen(false);
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
        role: user?.role || "employee",
        login,
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
