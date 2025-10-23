import { ChatMessageDTO } from '@/types/chat';
import { Client, StompSubscription, IFrame, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

interface WebSocketError {
  message: string;
  code?: string;
}

interface NotificationMessage {
  type: string;
  title: string;
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

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

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      // Configure STOMP client for your Spring Boot setup
      this.stompClient = new Client({
        // Use SockJS endpoint that matches your Spring Boot configuration
        webSocketFactory: () => {
          return new SockJS('http://localhost:8080/ws');
        },
        
        // Authentication headers
        connectHeaders: {
          'Authorization': `Bearer ${token}`,
        },
        
        // Debug logging
        debug: (str: string) => {
          console.log('[WebSocket Debug]:', str);
        },
        
        // Reconnection settings
        reconnectDelay: this.reconnectDelay,
        heartbeatIncoming: 10000,  // Expect heartbeat every 10 seconds
        heartbeatOutgoing: 10000,  // Send heartbeat every 10 seconds
      });

      // Connection established
      this.stompClient.onConnect = (frame: IFrame) => {
        console.log(`[${new Date().toISOString()}] Connected to WebSocket:`, frame);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      // Connection error
      this.stompClient.onStompError = (frame: IFrame) => {
        console.error(`[${new Date().toISOString()}] STOMP Error:`, frame);
        this.isConnected = false;
        
        const errorMessage = frame.headers['message'] || 'WebSocket connection failed';
        if (frame.headers['message']?.includes('Authentication') || frame.headers['message']?.includes('Unauthorized')) {
          reject(new Error('Authentication failed'));
        } else {
          reject(new Error(errorMessage));
        }
      };

      // Connection lost
      this.stompClient.onDisconnect = () => {
        console.log(`[${new Date().toISOString()}] Disconnected from WebSocket`);
        this.isConnected = false;
        this.subscriptions.clear();
        
        // Attempt reconnection if not intentional
        this.attemptReconnection(token);
      };

      // Web socket error
      this.stompClient.onWebSocketError = (error: Event) => {
        console.error(`[${new Date().toISOString()}] WebSocket Error:`, error);
        this.isConnected = false;
      };

      // Start connection
      console.log(`[${new Date().toISOString()}] Attempting to connect to WebSocket...`);
      this.stompClient.activate();
      
    });
  }

  private attemptReconnection(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[${new Date().toISOString()}] Max reconnection attempts reached`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`[${new Date().toISOString()}] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
    
    setTimeout(() => {
      this.connect(token).catch(error => {
        console.error(`[${new Date().toISOString()}] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      });
    }, this.reconnectDelay);
  }

  disconnect(): void {
    if (this.stompClient && this.isConnected) {
      console.log(`[${new Date().toISOString()}] Disconnecting from WebSocket...`);
      this.stompClient.deactivate();
      this.isConnected = false;
      this.subscriptions.clear();
      this.reconnectAttempts = 0;
    }
  }

  subscribeToRoom(chatRoomId: number, onMessage: (message: ChatMessageDTO) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] WebSocket not connected - cannot subscribe to room ${chatRoomId}`);
      
      // Queue the subscription to retry after connection
      setTimeout(() => {
        if (this.isConnected && this.stompClient) {
          this.subscribeToRoom(chatRoomId, onMessage);
        }
      }, 1000);
      return;
    }

    // Check if client is actually connected (additional safety check)
    if (!this.stompClient.connected) {
      console.warn(`[${new Date().toISOString()}] STOMP client not connected - waiting for connection`);
      
      // Wait for connection and retry
      const connectionCheckInterval = setInterval(() => {
        if (this.stompClient?.connected) {
          clearInterval(connectionCheckInterval);
          this.subscribeToRoom(chatRoomId, onMessage);
        }
      }, 500);
      
      // Clear interval after 10 seconds to prevent infinite waiting
      setTimeout(() => {
        clearInterval(connectionCheckInterval);
      }, 10000);
      return;
    }

    // Topic destination that matches your Spring Boot broker configuration
    const topic = `/topic/chat/${chatRoomId}`;
    
    // Unsubscribe if already subscribed
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
      try {
        const messageData: ChatMessageDTO = JSON.parse(message.body);
        console.log(`[${new Date().toISOString()}] Received message in room ${chatRoomId}:`, messageData);
        onMessage(messageData);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error parsing message from room ${chatRoomId}:`, error);
      }
    });

    this.subscriptions.set(topic, subscription);
    console.log(`[${new Date().toISOString()}] Subscribed to room ${chatRoomId} at ${topic}`);
  }

  unsubscribeFromRoom(chatRoomId: number): void {
    const topic = `/topic/chat/${chatRoomId}`;
    const subscription = this.subscriptions.get(topic);
    
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topic);
      console.log(`[${new Date().toISOString()}] Unsubscribed from room ${chatRoomId}`);
    }
  }

  subscribeToErrors(onError: (error: string) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] WebSocket not connected - cannot subscribe to errors`);
      
      setTimeout(() => {
        if (this.isConnected && this.stompClient) {
          this.subscribeToErrors(onError);
        }
      }, 1000);
      return;
    }

    if (!this.stompClient.connected) {
      console.warn(`[${new Date().toISOString()}] STOMP client not connected for error subscription`);
      return;
    }

    // User-specific error queue that matches your Spring Boot configuration
    const topic = '/user/queue/errors';
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    try {
      const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
        try {
          const errorMessage = message.body;
          console.log(`[${new Date().toISOString()}] Received error message:`, errorMessage);
          onError(errorMessage);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error parsing error message:`, error);
        }
      });

      this.subscriptions.set(topic, subscription);
      console.log(`[${new Date().toISOString()}] Subscribed to error messages at ${topic}`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to subscribe to errors:`, error);
    }

    // this.subscriptions.set(topic, subscription);
    // console.log(`[${new Date().toISOString()}] Subscribed to error messages at ${topic}`);
  }

  sendTextMessage(chatRoomId: number, content: string): void {
    if (!this.isConnected || !this.stompClient) {
      throw new Error('WebSocket not connected');
    }

    const payload = {
      content: content.trim()
    };

    // Destination that matches your @MessageMapping annotation
    const destination = `/app/chat.sendMessage/${chatRoomId}`;

    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(payload)
    });

    console.log(`[${new Date().toISOString()}] Sent text message to room ${chatRoomId} via ${destination}`);
  }

  sendImageMessage(chatRoomId: number, imageFile: File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.stompClient) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Check file size (limit to 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSize) {
        reject(new Error('Image file too large. Maximum size is 5MB.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1]; // Remove data:image/...;base64,
          
          const payload = {
            imageData: base64Data,
            filename: imageFile.name,
            contentType: imageFile.type
          };

          // Destination that matches your @MessageMapping annotation
          const destination = `/app/chat.sendImage/${chatRoomId}`;

          this.stompClient?.publish({
            destination: destination,
            body: JSON.stringify(payload)
          });

          console.log(`[${new Date().toISOString()}] Sent image message to room ${chatRoomId} via ${destination} (${imageFile.name}, ${imageFile.size} bytes)`);
          resolve();
        } catch (error) {
          console.error(`[${new Date().toISOString()}] Error processing image file:`, error);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error('Failed to read image file');
        console.error(`[${new Date().toISOString()}] FileReader error:`, error);
        reject(error);
      };

      reader.readAsDataURL(imageFile);
    });
  }

  sendImageFromUrl(chatRoomId: number, imageUrl: string): void {
    if (!this.isConnected || !this.stompClient) {
      throw new Error('WebSocket not connected');
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch (error) {
      throw new Error('Invalid image URL format');
    }

    const payload = {
      imageUrl: imageUrl
    };

    // Destination that matches your @MessageMapping annotation
    const destination = `/app/chat.sendImage/${chatRoomId}`;

    this.stompClient.publish({
      destination: destination,
      body: JSON.stringify(payload)
    });

    console.log(`[${new Date().toISOString()}] Sent image URL message to room ${chatRoomId} via ${destination} (${imageUrl})`);
  }

  subscribeToUserNotifications(onNotification: (notification: NotificationMessage) => void): void {
    if (!this.isConnected || !this.stompClient) {
      console.error(`[${new Date().toISOString()}] WebSocket not connected - cannot subscribe to user notifications`);
      return;
    }

    // User-specific notification queue
    const topic = '/user/queue/notifications';
    
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)?.unsubscribe();
    }

    const subscription = this.stompClient.subscribe(topic, (message: IMessage) => {
      try {
        const notification = JSON.parse(message.body);
        console.log(`[${new Date().toISOString()}] Received notification:`, notification);
        onNotification(notification);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error parsing notification:`, error);
      }
    });

    this.subscriptions.set(topic, subscription);
    console.log(`[${new Date().toISOString()}] Subscribed to user notifications at ${topic}`);
  }


//   Helper methods
//   Method to get current connection status
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

  // Method to handle connection state changes
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
}