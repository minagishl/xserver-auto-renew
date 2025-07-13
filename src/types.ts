export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
}

export interface UserAgentHeaders {
  [key: string]: string | null;
}

export interface ChromeHeaders {
  chrome: UserAgentHeaders;
}

export interface VpsExtendResponse {
  text: string;
  status: number;
}

export interface Settings {
  id_vps: string;
}

export interface LoginSettings {
  username: string;
  password: string;
}