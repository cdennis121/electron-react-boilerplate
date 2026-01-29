import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export interface ApiAuthSettings {
  apiUrl: string;
  authFor: string;
  authReseller: string;
  authPassword: string;
  authUser: string;
}

class ApiClient {
  private axiosInstance: AxiosInstance;
  private settings: ApiAuthSettings | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });

    // Request interceptor to add auth headers
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.settings) {
          config.headers['X-Auth-For'] = this.settings.authFor;
          config.headers['X-Auth-Reseller'] = this.settings.authReseller;
          config.headers['X-Auth-Password'] = this.settings.authPassword;
          config.headers['X-Auth-User'] = this.settings.authUser;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  setSettings(settings: ApiAuthSettings) {
    this.settings = settings;
    this.axiosInstance.defaults.baseURL = settings.apiUrl;
  }

  getSettings(): ApiAuthSettings | null {
    return this.settings;
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig) {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
