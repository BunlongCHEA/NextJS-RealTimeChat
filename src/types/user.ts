export interface User {
  id: number;
  username: string;
  fullName: string;
  avatarUrl: string;
  email: string;
  isActive: boolean;
  isLocked: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}