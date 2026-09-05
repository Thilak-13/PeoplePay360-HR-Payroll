import { AuthToken, LoginRequest, RegisterRequest, User, AuditLog, ChangePasswordRequest } from "./types";

const API_BASE = "/api/v1/auth";

export const getAuthToken = (): string | null => {
  return localStorage.getItem("peoplepay360_token");
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem("peoplepay360_token", token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem("peoplepay360_token");
  localStorage.removeItem("peoplepay360_user");
};

export const getStoredUser = (): User | null => {
  const data = localStorage.getItem("peoplepay360_user");
  return data ? JSON.parse(data) : null;
};

export const setStoredUser = (user: User): void => {
  localStorage.setItem("peoplepay360_user", JSON.stringify(user));
};

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: Bearer  } : {}),
  };
};

export async function loginUser(req: LoginRequest): Promise<AuthToken> {
  const res = await fetch(${API_BASE}/login, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Authentication failed");
  }
  const data: AuthToken = await res.json();
  setAuthToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function registerUser(req: RegisterRequest): Promise<User> {
  const res = await fetch(${API_BASE}/register, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Failed to register user");
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetch(${API_BASE}/me, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to fetch current user");
  }
  return res.json();
}

export async function changePassword(req: ChangePasswordRequest): Promise<{ status: string; message: string }> {
  const res = await fetch(${API_BASE}/change-password, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update password" }));
    throw new Error(err.detail || "Password update failed");
  }
  return res.json();
}

export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  const res = await fetch(${API_BASE}/audit-logs?limit=, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to fetch audit logs" }));
    throw new Error(err.detail || "Unauthorized or failed to fetch audit logs");
  }
  return res.json();
}

export async function seedDefaultUsers(): Promise<{ status: string; created_users: string[] }> {
  const res = await fetch(${API_BASE}/seed-default-users, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Failed to seed default users");
  }
  return res.json();
}
