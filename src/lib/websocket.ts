'use client';

import { AddedToChatRoomBroadcast, ChatMessageDTO, ChatRoomBroadcast, MessageStatusUpdate, ParticipantAddedBroadcast, UserStatusUpdate } from '@/types/chat';
import { Client, StompSubscription, IFrame, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

interface ConnectionStateCallback {
  (connected: boolean, status: string): void;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private stompClient: Client | null = null;
  private isConnected = false;
  private subscriptions = new Map<string, StompSubscription>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private connectionPromise: Promise<void> | null = null;
  // private userStatusSubscriptions: Map<number, StompJs.StompSubscription> = new Map();
  private userStatusSubscriptions: Map<number, StompSubscription> = new Map();

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Get WebSocket URL from environment with fallback
  // private getWebSocketUrl(): string {
  //   // Priority order: environment variable -> fallback URLs
  //   const envUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
  //   // Log the environment URL for debugging
  //   console.log(`[${new Date().toISOString()}] Environment WEBSOCKET_URL:`, envUrl);
    
  //   // Fallback URLs in case environment variable is not available
  //   const fallbackUrls = [
  //     envUrl,
  //     'https://chatspringboot.bunlong.site/ws', // Production fallback
  //     'http://localhost:8080/ws' // Development fallback
  //   ];

  //   // Find the first valid URL
  //   const url = fallbackUrls.find(u => u && u !== 'undefined' && u.trim() !== '');
    
  //   if (!url) {
  //     console.error(`[${new Date().toISOString()}] ❌ No valid WebSocket URL found in environment or fallbacks`);
  //     throw new Error('WebSocket URL not configured');
  //   }

  //   console.log(`[${new Date().toISOString()}] Using WebSocket URL:`, url);
  //   return url;
  // }

  connect(token: string): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.isConnected) {
      console.log(`[${new Date().toISOString()}] WebSocket already connected`);
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        console.log(`[${new Date().toISOString()}] Starting WebSocket connection...`);
        
        // Get WebSocket URL from environment
        // const websocketUrl = this.getWebSocketUrl();

        const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://chatspringboot.bunlong.site/ws';

        this.stompClient = new Client({
          webSocketFactory: () => {
            // return new SockJS('http://localhost:8080/ws');

            console.log(`[${new Date().toISOString()}] 🔌 Creating SockJS connection to: ${WEBSOCKET_URL}`);
            return new SockJS(WEBSOCKET_URL);

            // console.log(`[${new Date().toISOString()}] 🔌 Creating SockJS connection to: ${websocketUrl}`);
            // Create SockJS connection with the environment URL
            // return new SockJS(websocketUrl);
          },
          
          connectHeaders: {
            'Authorization': `Bearer ${token}`,
          },
          
          debug: (str: string) => {
            console.log('[WebSocket Debug]:', str);
          },
          
          reconnectDelay: this.reconnectDelay,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
        });

        this.stompClient.onConnect = (frame: IFrame) => {
          console.log(`[${new Date().toISOString()}] ✅ Connected to WebSocket:`, frame);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.connectionPromise = null;
          resolve();
        };

        this.stompClient.onStompError = (frame: IFrame) => {
          console.error(`[${new Date().toISOString()}] ❌ STOMP Error:`, frame);
          this.isConnected = false;
          this.connectionPromise = null;
          
          const errorMessage = frame.headers['message'] || 'WebSocket connection failed';
          if (frame.headers['message']?.includes('Authentication') || frame.headers['message']?.includes('Unauthorized')) {
            reject(new Error('Authentication failed'));
          } else {
            reject(new Error(errorMessage));
          }
        };

        this.stompClient.onDisconnect = () => {
          console.log(`[${new Date().toISOString()}] 🔌 Disconnected from WebSocket`);
          this.isConnected = false;
          this.connectionPromise = null;
          this.subscriptions.clear();
          this.attemptReconnection(token);
        };

        this.stompClient.onWebSocketError = (error: Event) => {
          console.error(`[${new Date().toISOString()}] ❌ WebSocket Error:`, error);
          this.isConnected = false;
          this.connectionPromise = null;
        };

        console.log(`[${new Date().toISOString()}] Activating WebSocket connection...`);
        this.stompClient.activate();
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Failed to create WebSocket connection:`, error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  private attemptReconnection(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[${new Date().toISOString()}] ⏹️ Max reconnection attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`[${new Date().toISOString()}] 🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.connect(token).catch(error => {
        console.error(`[${new Date().toISOString()}] ❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      });
    }, this.reconnectDelay);
  }

  disconnect(): void {
    if (this.stompClient && this.isConnected) {
      console.log(`[${new Date().toISOString()}] 🔌 Disconnecting from WebSocket...`);
      this.stompClient.deactivate();
      this.isConnected = false;
      this.subscriptions.clear();
      this.reconnectAttempts = 0;
      this.connectionPromise = null;
    }
  }


  // Subscribe to global message notifications (for sidebar updates)
  subscribeToGlobalMessageNotifications(onUpdate: (notification: ChatMessageDTO) => void): void {
    if (!this.isConnected || !this.stompClient) {
      return;
    }

    // const topic = '/user/queue/message-notifications';
    const topic = '/topic/message-notifications';
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const notification = JSON.parse(message.body);
          onUpdate(notification);
          console.log('Received global message notification:', notification);
        } catch (error) {
          console.error('Error parsing global message notification:', error);
        }
      });

      this.subscriptions.set(topic, subscription);
    } catch (error) {
      console.error('Failed to subscribe to global message notifications:', error);
    }
  }

  // Subscribe to chat updates for create a new chat room.
  subscribeToNewChatRoom(onUpdate: (update: ChatRoomBroadcast | AddedToChatRoomBroadcast) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ Cannot subscribe to chat updates - not connected`);
      return;
    }

    // const topic = '/user/queue/chat-updates';
    const topic = '/topic/chat-updates';
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const update: ChatRoomBroadcast | AddedToChatRoomBroadcast = JSON.parse(message.body);
          console.log(`[${new Date().toISOString()}] 🔥🔥🔥 RECEIVED CHAT UPDATE 🔥🔥🔥:`, update);
          onUpdate(update);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing chat update:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to chat updates at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe to chat updates:`, error);
    }
  }

  // Subscribe to room-specific updates for add new participants to the new or existing chat rooms
  subscribeParticipantsAdded(chatRoomId: number, onUpdate: (update: ParticipantAddedBroadcast) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ WebSocket not connected - cannot subscribe to room ${chatRoomId} updates`);
      return;
    }

    if (!this.stompClient.connected) {
      console.warn(`[${new Date().toISOString()}] ⚠️ STOMP client not connected for room updates`);
      return;
    }

    const topic = `/topic/chat/${chatRoomId}/updates`;
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const update: ParticipantAddedBroadcast = JSON.parse(message.body);
          console.log(`[${new Date().toISOString()}] 📢 Received room ${chatRoomId} update:`, update);
          onUpdate(update);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing room update:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to room ${chatRoomId} updates at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe to room updates:`, error);
    }
  }

  // Subscribe to Message / User status (EnumStatus) updates in a chat room
  subscribeToUserOrMessageStatus(chatRoomId: number, onStatusUpdate: (update: UserStatusUpdate | MessageStatusUpdate) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ WebSocket not connected - cannot subscribe to room ${chatRoomId} status`);
      return;
    }

    if (!this.stompClient.connected) {
      console.warn(`[${new Date().toISOString()}] ⚠️ STOMP client not connected for status updates`);
      return;
    }

    const topic = `/topic/chat/${chatRoomId}/status`;
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const statusData = JSON.parse(message.body);
          console.log(`[${new Date().toISOString()}] 📊 Received status update in room ${chatRoomId}:`, statusData);
          
          if (statusData.type === 'MESSAGE_STATUS_UPDATE') {
            const messageUpdate: MessageStatusUpdate = statusData;
            onStatusUpdate(messageUpdate);
          } else if (statusData.userId && statusData.username !== undefined) {
            const userUpdate: UserStatusUpdate = statusData;
            onStatusUpdate(userUpdate);
          }
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing status update:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to room ${chatRoomId} status at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe to room status:`, error);
    }
  }

  // Subscribe to a specific user's status updates. This allows tracking users across different rooms
  subscribeToUserStatus(userId: number, onStatusUpdate: (update: UserStatusUpdate) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ WebSocket not connected - cannot subscribe to user ${userId} status`);
      return;
    }

    const topic = `/topic/user/${userId}/status`;
    
    // Clean up existing subscription if any
    if (this.userStatusSubscriptions.has(userId)) {
      this.userStatusSubscriptions.get(userId)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const statusData = JSON.parse(message.body);
          console.log(`[${new Date().toISOString()}] 👤 User ${userId} status update:`, statusData);
          
          const userUpdate: UserStatusUpdate = {
            userId: statusData.userId,
            username: statusData.username,
            online: statusData.online,
            lastSeen: statusData.lastSeen
          };
          
          onStatusUpdate(userUpdate);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing user status update:`, error);
        }
      });

      this.userStatusSubscriptions.set(userId, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to user ${userId} status at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe to user status:`, error);
    }
  }

  // // Subscribe to global user status updates : online/offline status across all rooms
  // subscribeToGlobalUserStatus(userId: number, onStatusUpdate: (update: UserStatusUpdate) => void): void {
  //   if (!this.isConnected || !this.stompClient) {
  //     console.error(`[${new Date().toISOString()}] ❌ WebSocket not connected`);
  //     return;
  //   }

  //   const topic = `/user/topic/status`;
    
  //   if (this.subscriptions.has(topic)) {
  //     this.subscriptions.get(topic)?.unsubscribe();
  //   }

  //   try {
  //     const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
  //       try {
  //         const statusData = JSON.parse(message.body);
  //         console.log(`[${new Date().toISOString()}] 📊 Received global user status:`, statusData);
  //         onStatusUpdate(statusData);
  //       } catch (error) {
  //         console.error(`[${new Date().toISOString()}] ❌ Error parsing status:`, error);
  //       }
  //     });

  //     this.subscriptions.set(topic, subscription);
  //     console.log(`[${new Date().toISOString()}] ✅ Subscribed to global user status`);
  //   } catch (error) {
  //     console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe:`, error);
  //   }
  // }

  // Unsubscribe from specific user status
  unsubscribeFromUserStatus(userId: number): void {
    const subscription = this.userStatusSubscriptions.get(userId);
    if (subscription) {
      subscription.unsubscribe();
      this.userStatusSubscriptions.delete(userId);
      console.log(`[${new Date().toISOString()}] 🔕 Unsubscribed from user ${userId} status`);
    }
  }

  // Unsubscribe from room updates
  unsubscribeFromRoomUpdates(chatRoomId: number): void {
    const updatesTopic = `/topic/chat/${chatRoomId}/updates`;
    const statusTopic = `/topic/chat/${chatRoomId}/status`;
    
    [updatesTopic, statusTopic].forEach(topic => {
      const subscription = this.subscriptions.get(topic);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(topic);
        console.log(`[${new Date().toISOString()}] ✅ Unsubscribed from ${topic}`);
      }
    });
  }

  // Subscribe to errors
  subscribeToErrors(onError: (error: string) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ Cannot subscribe to errors - not connected`);
      return;
    }

    const topic = '/user/queue/errors';
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const errorMessage = message.body;
          console.log(`[${new Date().toISOString()}] ❌ Received error message:`, errorMessage);
          onError(errorMessage);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing error message:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to error messages at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] ❌ Failed to subscribe to errors:`, error);
    }
  }

  // Subscribe to messages in a specific chat room
  subscribeToRoom(chatRoomId: number, onMessage: (message: ChatMessageDTO) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] ❌ WebSocket not connected - cannot subscribe to room ${chatRoomId}`);
      
      setTimeout(() => {
        if (this.isConnected && this.stompClient) {
          this.subscribeToRoom(chatRoomId, onMessage);
        }
      }, 1000);
      return;
    }

    if (!this.stompClient.connected) {
      console.warn(`[${new Date().toISOString()}] ⚠️ STOMP client not connected - waiting for connection`);
      
      const connectionCheckInterval = setInterval(() => {
        if (this.stompClient?.connected) {
          clearInterval(connectionCheckInterval);
          this.subscribeToRoom(chatRoomId, onMessage);
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(connectionCheckInterval);
      }, 10000);
      return;
    }

    // Topic destination that matches your Spring Boot broker configuration
    const topic = `/topic/chat/${chatRoomId}`;
    
    // Unsubscribe if already subscribed
    if (this.subscriptions.has(topic)) {
      console.log(`Unsubscribing from existing subscription to ${topic}`);
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const messageData: ChatMessageDTO = JSON.parse(message.body);
          console.log(`[${new Date().toISOString()}] 💬 Received message in room ${chatRoomId}:`, messageData);
          onMessage(messageData);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error parsing message from room ${chatRoomId}:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] ✅ Subscribed to room ${chatRoomId} at ${topic}`);

      // Also subscribe to room updates and status when subscribing to messages
      this.subscribeParticipantsAdded(chatRoomId, (update) => {
        console.log(`Participant added to room ${chatRoomId}:`, update);
      });
      
      this.subscribeToUserOrMessageStatus(chatRoomId, (update) => {
        console.log(`Status update in room ${chatRoomId}:`, update);
      });

    } catch (error) {
      console.error(`Failed to subscribe to room ${chatRoomId}:`, error);
    }
  }

  unsubscribeFromRoom(chatRoomId: number): void {
    const topic = `/topic/chat/${chatRoomId}`;
    const subscription = this.subscriptions.get(topic);
    
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topic);
      console.log(`[${new Date().toISOString()}] ✅ Unsubscribed from room ${chatRoomId}`);
    }

    this.unsubscribeFromRoomUpdates(chatRoomId);
  }

  sendTextMessage(chatRoomId: number, content: string): void {
    if (!this.isConnected || !this.stompClient) {
      throw new Error('WebSocket not connected');
    }

    const payload = {
      content: content.trim()
    };

    const destination = `/app/chat.sendMessage/${chatRoomId}`;

    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(payload)
    });

    console.log(`[${new Date().toISOString()}] ✅ Sent text message to room ${chatRoomId} via ${destination}`);
  }

  sendImageMessage(chatRoomId: number, imageFile: File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.stompClient) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSize) {
        reject(new Error('Image file too large. Maximum size is 5MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          
          const payload = {
            imageData: base64Data,
            filename: imageFile.name,
            contentType: imageFile.type
          };

          const destination = `/app/chat.sendImage/${chatRoomId}`;

          this.stompClient?.publish({
            destination: destination,
            body: JSON.stringify(payload)
          });

          console.log(`[${new Date().toISOString()}] ✅ Sent image message to room ${chatRoomId} via ${destination} (${imageFile.name}, ${imageFile.size} bytes)`);
          resolve();
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ Error processing image file:`, error);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error('Failed to read image file');
        console.error(`[${new Date().toISOString()}] ❌ FileReader error:`, error);
        reject(error);
      };

      reader.readAsDataURL(imageFile);
    });
  }

  sendImageFromUrl(chatRoomId: number, imageUrl: string): void {
    if (!this.isConnected || !this.stompClient) {
      throw new Error('WebSocket not connected');
    }

    try {
      new URL(imageUrl);
    } catch (error) {
      throw new Error('Invalid image URL format');
    }

    const payload = {
      imageUrl: imageUrl
    };

    const destination = `/app/chat.sendImage/${chatRoomId}`;

    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(payload)
    });

    console.log(`[${new Date().toISOString()}] ✅ Sent image URL message to room ${chatRoomId} via ${destination} (${imageUrl})`);
  }

  // Helper methods
  isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  getConnectionStatus(): string {
    if (this.isConnected) {
      return 'Connected';
    } else if (this.reconnectAttempts > 0) {
      return `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
    } else {
      return 'Disconnected';
    }
  }

  onConnectionStateChange(callback: ConnectionStateCallback): void {
    if (this.stompClient) {
      const originalOnConnect = this.stompClient.onConnect;
      const originalOnDisconnect = this.stompClient.onDisconnect;

      this.stompClient.onConnect = (frame: IFrame) => {
        if (originalOnConnect) {
          originalOnConnect(frame);
        }
        callback(true, this.getConnectionStatus());
      };

      this.stompClient.onDisconnect = (frame: IFrame) => {
        if (originalOnDisconnect) {
          originalOnDisconnect(frame);
        }
        callback(false, this.getConnectionStatus());
      };
    }
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}