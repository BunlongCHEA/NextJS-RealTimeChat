import { 
  ChatRoomDTO, 
  ChatMessageDTO, 
  CreateChatRoomRequest, 
  EnumRoomType,
  EnumMessageType,
  EnumRoomRole,
  EnumStatus,
  ParticipantDTO,
  PageRequest, 
  MessageStatus,
  CreateChatRoomDTO,
  CreatePersonalChatRequest
} from "@/types/chat";
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


  // Users API
  static async getUserByUsername(username: string): Promise<User> {
    const params = new URLSearchParams({ username });
    return this.request<User>(`/users/username?${params}`);
  }


  // Chat Rooms API
  static async getAllChatRooms(): Promise<ChatRoomDTO[]> {
    return this.request<ChatRoomDTO[]>('/rooms');
  }

  static async getChatRoomsByUserId(userId: number): Promise<ChatRoomDTO[]> {
    return this.request<ChatRoomDTO[]>(`/rooms/user/${userId}`);
  }

  static async getChatRoomById(id: number): Promise<ChatRoomDTO> {
    return this.request<ChatRoomDTO>(`/rooms/${id}`);
  }

  static async createChatRoom(roomData: CreateChatRoomDTO, currentUserId: number): Promise<ChatRoomDTO> {
    return this.request<ChatRoomDTO>(`/rooms?currentUserId=${currentUserId}`, {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  }

  static async createOrFindPersonalChat(otherUserId: number, currentUserId: number): Promise<ChatRoomDTO> {
    const roomData: CreatePersonalChatRequest = {
      type: EnumRoomType.PERSONAL,
      participants: [{ userId: otherUserId }]
    };
    
    return this.createChatRoom(roomData, currentUserId);
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


  // Chat Messages API
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


  // Participants API
  static async getParticipantById(id: number): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>(`/participants/${id}`);
  }

  static async getParticipantsByChatRoomId(chatRoomId: number): Promise<ParticipantDTO[]> {
    return this.request<ParticipantDTO[]>(`/participants/room/${chatRoomId}`);
  }

  static async getParticipantByUserAndChatRoom(userId: number, chatRoomId: number): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>(`/participants/user/${userId}/room/${chatRoomId}`);
  }

  static async getParticipantsByUserId(userId: number): Promise<ParticipantDTO[]> {
    return this.request<ParticipantDTO[]>(`/participants/user/${userId}`);
  }

  static async getChatPartners(userId: number): Promise<ParticipantDTO[]> {
    return this.request<ParticipantDTO[]>(`/participants/user/${userId}/chat-partners`);
  }

  static async getPersonalChatPartners(userId: number): Promise<ParticipantDTO[]> {
    return this.request<ParticipantDTO[]>(`/participants/user/${userId}/personal-chat-partners`);
  }


  // Participant Management
  static async addParticipantToChatRoom(
    chatRoomId: number, 
    userId: number, 
    addedByUserId: number
  ): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>('/participants/add', {
      method: 'POST',
      body: JSON.stringify({ chatRoomId, userId, addedByUserId }),
    });
  }

  static async removeParticipantFromChatRoom(
    participantId: number, 
    removedByUserId: number
  ): Promise<void> {
    return this.request<void>(`/participants/${participantId}/remove?removedByUserId=${removedByUserId}`, {
      method: 'DELETE',
    });
  }

  static async updateParticipantRole(
    participantId: number, 
    newRole: EnumRoomRole, 
    updatedByUserId: number
  ): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>(`/participants/${participantId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ newRole, updatedByUserId }),
    });
  }

  // Status Management
  static async updateParticipantStatus(
    participantId: number, 
    muted?: boolean, 
    blocked?: boolean
  ): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>(`/participants/${participantId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ muted, blocked }),
    });
  }

  static async updateLastReadMessageId(
    userId: number, 
    chatRoomId: number, 
    messageId: number
  ): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>('/participants/last-read', {
      method: 'PUT',
      body: JSON.stringify({ userId, chatRoomId, messageId }),
    });
  }

  static async updateOnlineStatus(userId: number, online: boolean): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>('/participants/online-status', {
      method: 'PUT',
      body: JSON.stringify({ userId, online }),
    });
  }

  static async updateLastSeen(userId: number, lastSeen: string): Promise<ParticipantDTO> {
    return this.request<ParticipantDTO>('/participants/last-seen', {
      method: 'PUT',
      body: JSON.stringify({ userId, lastSeen }),
    });
  }


  // Message Status API
  static async createMessageStatus(
    userId: number, 
    messageId: number, 
    status: EnumStatus
  ): Promise<MessageStatus> {
    return this.request<MessageStatus>('/message-status', {
      method: 'POST',
      body: JSON.stringify({ userId, messageId, status }),
    });
  }

  static async updateMessageStatus(
    userId: number, 
    messageId: number, 
    status: EnumStatus
  ): Promise<MessageStatus> {
    return this.request<MessageStatus>('/message-status/update', {
      method: 'PUT',
      body: JSON.stringify({ userId, messageId, status }),
    });
  }

  static async getMessageStatusByUserAndMessage(
    userId: number, 
    messageId: number
  ): Promise<MessageStatus> {
    return this.request<MessageStatus>(`/message-status/user/${userId}/message/${messageId}`);
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