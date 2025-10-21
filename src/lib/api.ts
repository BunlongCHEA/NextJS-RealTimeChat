import { ChatMessage, ChatMessageDTO, ChatRoom, ChatRoomDTO, CreateChatRoomRequest, EnumRoomType, PageRequest } from "@/types/chat";
import { AuthResponse, LoginRequest, RegisterRequest, User } from "@/types/user";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

export class ApiService {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle your BaseDTO response structure
    const result = await response.json();
    console.log('API Response:', result);
    return result.data; // Extract the data from BaseDTO
  }

  private static getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // Extract refreshToken, accessToken and user from your LoginResponse DTO model
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    };
  }

  static async register(userData: RegisterRequest): Promise<AuthResponse> {
     const result = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // For register, handle data based on UserDTO model
    return {
      user: result.user,
      accessToken: '',
      refreshToken: ''
    };
  }

  static async getCurrentUser(token: string): Promise<User> {
    console.log('Fetching current user with token:', token);
    return this.request<User>('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }


  // Chat Rooms API - matching with Spring Boot endpoints
  static async getAllChatRooms(): Promise<ChatRoomDTO[]> {
    return this.request<ChatRoomDTO[]>('/rooms');
  }

  static async getChatRoomsByUserId(userId: number): Promise<ChatRoomDTO[]> {
    return this.request<ChatRoomDTO[]>(`/rooms/user/${userId}`);
  }

  static async getChatRoomById(id: number): Promise<ChatRoomDTO> {
    return this.request<ChatRoomDTO>(`/rooms/${id}`);
  }

  static async createChatRoom(roomData: CreateChatRoomRequest, currentUserId: number): Promise<ChatRoomDTO> {
    return this.request<ChatRoomDTO>(`/rooms?currentUserId=${currentUserId}`, {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  }

  static async updateChatRoom(
    id: number, 
    roomData: Partial<CreateChatRoomRequest>, 
    currentUserId: number
  ): Promise<ChatRoomDTO> {
    return this.request<ChatRoomDTO>(`/rooms/${id}?currentUserId=${currentUserId}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  }

  static async deleteChatRoom(
    id: number, 
    userId: number, 
    deleteForAll: boolean = false
  ): Promise<void> {
    return this.request<void>(`/rooms/${id}?userId=${userId}&deleteForAll=${deleteForAll}`, {
      method: 'DELETE',
    });
  }


  // Messages API - matching your Spring Boot endpoints
  static async getMessageById(id: number): Promise<ChatMessageDTO> {
    return this.request<ChatMessageDTO>(`/messages/${id}`);
  }

  static async getMessagesByChatRoomId(
    chatRoomId: number, 
    pageRequest: PageRequest = { page: 0, size: 50 }
  ): Promise<ChatMessageDTO[]> {
    const params = new URLSearchParams({
      page: pageRequest.page.toString(),
      size: pageRequest.size.toString(),
    });
    if (pageRequest.sort) {
      params.append('sort', pageRequest.sort);
    }
    
    return this.request<ChatMessageDTO[]>(`/messages/room/${chatRoomId}?${params}`);
  }

  static async createTextMessage(
    chatRoomId: number, 
    senderId: number, 
    content: string
  ): Promise<ChatMessageDTO> {
    return this.request<ChatMessageDTO>('/messages/text', {
      method: 'POST',
      body: JSON.stringify({ chatRoomId, senderId, content }),
    });
  }

  static async createImageMessage(
    chatRoomId: number, 
    senderId: number, 
    imageFile: File
  ): Promise<ChatMessageDTO> {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('imageFile', imageFile);
    
    const response = await fetch(`${API_BASE_URL}/messages/image?chatRoomId=${chatRoomId}&senderId=${senderId}`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to send image');
    }

    const result = await response.json();
    return result.data || result;
  }

  static async createImageMessageFromUrl(
    chatRoomId: number, 
    senderId: number, 
    imageUrl: string
  ): Promise<ChatMessageDTO> {
    return this.request<ChatMessageDTO>('/messages/image-url', {
      method: 'POST',
      body: JSON.stringify({ chatRoomId, senderId, imageUrl }),
    });
  }


  // Helper methods for frontend
  static async searchChatRooms(query: string, type?: EnumRoomType): Promise<ChatRoomDTO[]> {
    const params = new URLSearchParams({ q: query });
    if (type) {
      params.append('type', type);
    }
    return this.request<ChatRoomDTO[]>(`/rooms/search?${params}`);
  }

  static async searchMessages(query: string, chatRoomId?: number): Promise<ChatMessageDTO[]> {
    const params = new URLSearchParams({ q: query });
    if (chatRoomId) {
      params.append('chatRoomId', chatRoomId.toString());
    }
    return this.request<ChatMessageDTO[]>(`/messages/search?${params}`);
  }
}