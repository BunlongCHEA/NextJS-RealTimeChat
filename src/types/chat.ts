import { User } from './user';

export enum EnumRoomType {
  PERSONAL = 'PERSONAL',
  GROUP = 'GROUP',
  CHANNEL = 'CHANNEL'
}

export enum EnumMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM'
}

export enum EnumRoomRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export enum EnumStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ'
}

export interface ChatRoom {
  id: number;
  name: string;
  type: EnumRoomType;
  participants: Participant[];
  createdUserId?: User;
  chatMessages?: ChatMessage; // last message
  
  // Transient fields from Spring Boot
  lastMessageContent?: string;
  lastMessageSenderUsername?: string;
  lastMessageTimestamp?: string; // ISO string from Instant
  lastMessageType?: EnumMessageType;
  lastMessageAttachmentCount?: number;
  lastMessageId?: number;
  
  // Additional frontend fields
  avatarUrl?: string; // derived from participants or set separately
  unreadCount?: number; // calculated on frontend
}

export interface ChatRoomDTO {
  id: number;
  name: string;
  type: EnumRoomType;
  participants: ParticipantDTO[];
  createdUserId?: number;
  lastMessageContent?: string;
  lastMessageSenderUsername?: string;
  lastMessageTimestamp?: string;
  lastMessageType?: EnumMessageType;
  lastMessageAttachmentCount?: number;
  avatarUrl?: string;
  unreadCount?: number;
}


export interface ChatMessage {
  id: number;
  chatRooms: ChatRoom; // matches Spring Boot relationship name
  sender: User;
  content: string;
  type: EnumMessageType;
  timestamp: string; // ISO string from Instant
  attachmentUrls: string[];
  statuses: MessageStatus[];
  
  // Transient fields from Spring Boot
  chatRoomId: number;
  senderName: string;
  
  // Additional frontend helper fields
  senderUsername?: string;
  senderFullName?: string;
  senderAvatarUrl?: string;
}

export interface ChatMessageDTO {
  id: number;
  chatRoomId: number;
  senderId: number;
  senderUsername: string;
  senderFullName: string;
  senderAvatarUrl?: string;
  content: string;
  type: EnumMessageType;
  timestamp: string;
  attachmentUrls: string[];
}


export interface MessageStatus {
  id: number;
  users: User; // matches Spring Boot relationship name
  chatMessages: ChatMessage; // matches Spring Boot relationship name
  status: EnumStatus;
  timestamp: string; // ISO string from Instant
  
  // Transient fields from Spring Boot
  userId: number;
  messageId: number;
}

export interface Participant {
  id: number;
  users: User; // matches Spring Boot relationship name
  chatRooms: ChatRoom; // matches Spring Boot relationship name
  role: EnumRoomRole;
  muted: boolean;
  blocked: boolean;
  joinDate: string; // ISO string from Instant
  lastReadMessageId?: number;
  online: boolean;
  lastSeen?: string; // ISO string from Instant
  
  // Transient fields from Spring Boot
  userId: number;
  chatRoomId: number;
  username: string;
  fullName: string;
}

export interface ParticipantDTO {
  id: number;
  userId: number;
  chatRoomId: number;
  username: string;
  fullName: string;
  role: EnumRoomRole;
  muted: boolean;
  blocked: boolean;
  online: boolean;
  lastSeen?: string;
  joinDate: string;
  lastReadMessageId?: number;
}


// Request/Response DTOs for API calls
export interface CreateChatRoomRequest {
  name: string;
  type: EnumRoomType;
  participantIds?: number[];
}

export interface SendMessageRequest {
  chatRoomId: number;
  content: string;
  type?: EnumMessageType;
}

export interface SendImageMessageRequest {
  chatRoomId: number;
  imageFile: File;
}

// Helper types for frontend state management
export type ChatFilter = 'ALL' | 'PERSONAL' | 'GROUP' | 'CHANNEL';
export type SearchFilter = 'CHATS' | 'MESSAGES' | 'FRIENDS' | 'CHANNELS';

// Pagination types
export interface PageRequest {
  page: number;
  size: number;
  sort?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}