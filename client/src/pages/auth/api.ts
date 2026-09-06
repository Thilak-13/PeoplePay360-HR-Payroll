import axios from 'axios';
import { AuthToken, LoginRequest, RegisterRequest, User, AuditLog, ChangePasswordRequest, SignupRequest, RegistrationRequest } from './types';

const API_BASE = '/api/v1/auth';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('peoplepay360_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('peoplepay360_token', token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem('peoplepay360_token');
  localStorage.removeItem('peoplepay360_user');
};

export const getStoredUser = (): User | null => {
  const data = localStorage.getItem('peoplepay360_user');
  return data ? JSON.parse(data) : null;
};

export const setStoredUser = (user: User): void => {
  localStorage.setItem('peoplepay360_user', JSON.stringify(user));
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Global Axios Request Interceptor for automatic Bearer token injection
axios.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));


export async function loginUser(req: LoginRequest): Promise<AuthToken> {
  const res = await axios.post<AuthToken>(`${API_BASE}/login`, req);
  const data = res.data;
  setAuthToken(data.access_token);
  setStoredUser(data.user);
  return data;
}

export async function registerUser(req: RegisterRequest): Promise<User> {
  const res = await axios.post<User>(`${API_BASE}/register`, req, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await axios.get<User>(`${API_BASE}/me`, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function changePassword(req: ChangePasswordRequest): Promise<{ status: string; message: string }> {
  const res = await axios.post<{ status: string; message: string }>(`${API_BASE}/change-password`, req, {
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function fetchAuditLogs(limit = 50): Promise<AuditLog[]> {
  const res = await axios.get<AuditLog[]>(`${API_BASE}/audit-logs`, {
    params: { limit },
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function seedDefaultUsers(): Promise<{ status: string; created_users: string[] }> {
  const res = await axios.post<{ status: string; created_users: string[] }>(`${API_BASE}/seed-default-users`);
  return res.data;
}

export async function submitSignup(req: SignupRequest): Promise<RegistrationRequest> {
  const res = await axios.post<RegistrationRequest>(`${API_BASE}/signup`, req);
  return res.data;
}

export async function fetchRegistrationRequests(statusFilter?: string): Promise<RegistrationRequest[]> {
  const res = await axios.get<RegistrationRequest[]>(`${API_BASE}/registration-requests`, {
    params: statusFilter ? { status_filter: statusFilter } : {},
    headers: getAuthHeaders(),
  });
  return res.data;
}

export async function approveRegistrationRequest(id: number): Promise<{ message: string; registration_request: RegistrationRequest; user: User }> {
  const res = await axios.post<{ message: string; registration_request: RegistrationRequest; user: User }>(
    `${API_BASE}/registration-requests/${id}/approve`,
    {},
    { headers: getAuthHeaders() }
  );
  return res.data;
}

export async function rejectRegistrationRequest(id: number, reason?: string): Promise<RegistrationRequest> {
  const res = await axios.post<RegistrationRequest>(
    `${API_BASE}/registration-requests/${id}/reject`,
    { rejection_reason: reason },
    { headers: getAuthHeaders() }
  );
  return res.data;
}

