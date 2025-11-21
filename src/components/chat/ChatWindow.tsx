'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { 
  ChatRoomDTO, 
  ChatMessageDTO, 
  EnumMessageType, 
  EnumRoomType, 
  EnumRoomRole, 
  EnumStatus,
  ParticipantDTO, 
  UserStatusUpdate,
  MessageStatusUpdate
} from '@/types/chat';
import { getChatRoomAvatar, getChatRoomDisplayName, formatMessageTime, getOnlineStatus, userStatus } from '@/lib/chat-utils';
import { User } from '@/types/user';
import Image from 'next/image';
import { 
  PaperAirplaneIcon,
  PhotoIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  FaceSmileIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  CheckCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import {
  CheckCheck
} from 'lucide-react';
import { WebSocketService } from '@/lib/websocket';
import ChatRoomOptionsMenu from './ChatRoomOptionsMenu';
import router from 'next/router';

interface ChatWindowProps {
  roomId: number;
  onBack?: () => void;
  onRoomCreated?: (roomId: number) => void; // Add this prop to notify parent about new room
  onMessageSent?: () => void; // Add this prop to refresh sidebar when message is sent
}

export default function ChatWindow({ roomId, onBack, onRoomCreated, onMessageSent }: ChatWindowProps) {
  const { user, loading: authLoading, token } = useAuth();
  const [chatRoom, setChatRoom] = useState<ChatRoomDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [messageStatuses, setMessageStatuses] = useState<Map<number, Map<number, EnumStatus>>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsService = useRef(WebSocketService.getInstance());
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [currentUserParticipant, setCurrentUserParticipant] = useState<ParticipantDTO | null>(null);
  const [visibleMessages, setVisibleMessages] = useState<Set<number>>(new Set());
  const intersectionObserver = useRef<IntersectionObserver | null>(null);

  const subscribedUserIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (roomId && user && token) {
      loadChatRoom();
      loadMessages();
      connectWebSocket();
    }

    return () => {
      // Cleanup WebSocket subscription when component unmounts or roomId changes
      if (wsService.current) {
        wsService.current.unsubscribeFromRoom(roomId);
      }

      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [roomId, user, token, authLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  useEffect(() => {
    if (user && chatRoom && chatRoom.participants) {
      const participant = chatRoom.participants.find(p => p.userId === user.id);
      setCurrentUserParticipant(participant || null);
    }
  }, [user, chatRoom]);

  // Add periodic refresh (add to existing useEffect)
  useEffect(() => {
    if (chatRoom && user) {
      const statusRefreshInterval = setInterval(() => {
        // refreshUserStatus();
      }, 5000); // Refresh in seconds
      
      return () => clearInterval(statusRefreshInterval);
    }
  }, [chatRoom, user]);

  // Set up intersection observer for message visibility
  useEffect(() => {
    if (intersectionObserver.current) {
      intersectionObserver.current.disconnect();
    }

    intersectionObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const messageId = parseInt(entry.target.getAttribute('data-message-id') || '0');
          if (entry.isIntersecting && messageId > 0) {
            setVisibleMessages(prev => new Set([...prev, messageId]));
            
            // Auto-mark as read when message becomes visible (with small delay)
            setTimeout(() => {
              markMessageAsRead(messageId);
            }, 500); // 0.5 second delay to ensure user actually sees the message

          } else if (!entry.isIntersecting && messageId > 0) {
            setVisibleMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(messageId);
              return newSet;
            });
          }
        });
      },
      { 
        threshold: 0.7,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    return () => {
      if (intersectionObserver.current) {
        intersectionObserver.current.disconnect();
      }
    };
  }, [user]);

  // Auto-mark messages as delivered when they load
  // Always fetch and display the backend status for all messages sent by the user
  useEffect(() => {
    if (messages.length > 0 && user) {
      messages.forEach(async (message) => {
        // For all messages sent by the current user, fetch their status
        if (message.senderId === user.id && message.id > 0) {
          try {
            const existingStatus = await ApiService.getMessageStatusByUserAndMessage(user.id, message.id, false);
            setMessageStatuses(prev => {
              const newStatuses = new Map(prev);
              if (!newStatuses.has(message.id)) {
                newStatuses.set(message.id, new Map());
              }
              const messageStatusMap = newStatuses.get(message.id)!;
              messageStatusMap.set(user.id, existingStatus.status);
              return newStatuses;
            });
          } catch {
            // If no status exists, do not set anything (will show as SENT by default)
          }
        } else if (message.senderId !== user.id && message.id > 0) {
          // For received messages, keep previous logic (auto-mark as delivered if no status)
          try {
            try {
              const existingStatus = await ApiService.getMessageStatusByUserAndMessage(user.id, message.id, true);
              setMessageStatuses(prev => {
                const newStatuses = new Map(prev);
                if (!newStatuses.has(message.id)) {
                  newStatuses.set(message.id, new Map());
                }
                const messageStatusMap = newStatuses.get(message.id)!;
                messageStatusMap.set(user.id, existingStatus.status);
                return newStatuses;
              });
            } catch {
              await ApiService.createMessageStatus(user.id, message.id, EnumStatus.DELIVERED);
              setMessageStatuses(prev => {
                const newStatuses = new Map(prev);
                if (!newStatuses.has(message.id)) {
                  newStatuses.set(message.id, new Map());
                }
                const messageStatusMap = newStatuses.get(message.id)!;
                messageStatusMap.set(user.id, EnumStatus.DELIVERED);
                return newStatuses;
              });
            }
          } catch (error) {
            console.error('Failed to process message status:', error);
          }
        }
      });
    }
  }, [messages, user]);



  // Subscribe to room-level status updates
  useEffect(() => {
    if (!chatRoom || !wsService.current) return;

    wsService.current.subscribeToUserOrMessageStatus(
      roomId,
      (update: UserStatusUpdate | MessageStatusUpdate) => {
        if ('type' in update && update.type === 'MESSAGE_STATUS_UPDATE') {
          handleMessageStatusUpdate(update);
        } else if ('username' in update) {
          handleUserStatusUpdate(update as UserStatusUpdate);
        }
      }
    );

    return () => {
      // Cleanup handled by WebSocketService
    };
  }, [chatRoom, roomId]);

  // Subscribe to individual user status updates for all participants
  useEffect(() => {
    if (!chatRoom?.participants || !wsService.current) return;

    const newUserIds = new Set<number>();

    // Subscribe to each participant's status
    chatRoom.participants.forEach(participant => {
      if (!subscribedUserIds.current.has(participant.userId)) {
        wsService.current?.subscribeToUserStatus(
          participant.userId,
          handleUserStatusUpdate
        );
        subscribedUserIds.current.add(participant.userId);
      }
      newUserIds.add(participant.userId);
    });

    // Unsubscribe from users no longer in participants
    subscribedUserIds.current.forEach(userId => {
      if (!newUserIds.has(userId)) {
        wsService.current?.unsubscribeFromUserStatus(userId);
        subscribedUserIds.current.delete(userId);
      }
    });

    return () => {
      // Cleanup: unsubscribe from all user status subscriptions
      subscribedUserIds.current.forEach(userId => {
        wsService.current?.unsubscribeFromUserStatus(userId);
      });
      subscribedUserIds.current.clear();
    };
  }, [chatRoom?.participants]);



  // Message Status Handling

  // Mark messages as read when they become visible
  const markMessageAsRead = async (messageId: number) => {
    if (!user || !messageId || messageId < 0) {
      console.log(`[ChatWindow] Skipping read status for invalid messageId: ${messageId}`);
      return;
    }

    try {
      // console.log(`[ChatWindow] Marking message ${messageId} as read for user ${user.id}`);
      
      // Check if status already exists and is not READ
      try {
        const existingStatus = await ApiService.getMessageStatusByUserAndMessage(user.id, messageId, true);

        if (existingStatus.status === EnumStatus.READ) {
          console.log(`[ChatWindow] Message ${messageId} already marked as read`);
          return;
        }

        // Update existing status to READ
        await ApiService.updateMessageStatus(user.id, messageId, EnumStatus.READ);
        // console.log(`[ChatWindow] Updated message ${messageId} status to READ and user ${user.id}`);
        
      } catch (error) {
        // Status doesn't exist, create it as read
        console.log(`[ChatWindow] Creating read status for message ${messageId}`);
        // await ApiService.createMessageStatus(user.id, messageId, EnumStatus.READ);
        // await ApiService.updateMessageStatus(user.id, messageId, EnumStatus.READ);
      }
      
      // Update local state
      setMessageStatuses(prev => {
        const newStatuses = new Map(prev);
        if (!newStatuses.has(messageId)) {
          newStatuses.set(messageId, new Map());
        }
        const messageStatusMap = newStatuses.get(messageId)!;
        messageStatusMap.set(user.id, EnumStatus.READ);
        return newStatuses;
      });

      // if (onMessageSent) {
      //   onMessageSent();
      // }

    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  // // Add this function inside ChatWindow component
  // const refreshUserStatus = async () => {
  //   if (!chatRoom || !user) return;
    
  //   try {
  //     // Reload chat room to get fresh participant data
  //     const updatedRoom = await ApiService.getChatRoomById(roomId);
  //     setChatRoom(updatedRoom);

  //     console.log('✅ User status refreshed');
  //   } catch (error) {
  //     console.error('Failed to refresh user status:', error);
  //   }
  // };

  // WebSocket connection and subscriptions

  const connectWebSocket = async () => {
    if (!user || !token) return;

    try {
      await wsService.current.connect(token);
      setWsConnected(true);
      setError(null);

      // Subscribe to room messages
      wsService.current.subscribeToRoom(roomId, (message: ChatMessageDTO) => {
        console.log(`[ChatWindow] Received message in room ${roomId}:`, message);
        
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });

        // Auto-mark new messages as delivered
        if (message.senderId !== user.id  && message.id > 0) {
          setTimeout(async () => {
            try {
              // Current user is receiving the message, so they are the "received" user
              await ApiService.createMessageStatus(user.id, message.id, EnumStatus.DELIVERED);
              console.log(`[ChatWindow] Marked message ${message.id} as delivered for user ${user.id}`);
              setMessageStatuses(prev => {
                const newStatuses = new Map(prev);
                if (!newStatuses.has(message.id)) {
                  newStatuses.set(message.id, new Map());
                }
                const messageStatusMap = newStatuses.get(message.id)!;
                messageStatusMap.set(user.id, EnumStatus.DELIVERED);
                return newStatuses;
              });
            } catch (error) {
              console.error('Failed to mark new message as delivered:', error);
            }
          }, 500);
        }

        // Notify parent to refresh sidebar when new message arrives
        // if (onMessageSent) {
        //   onMessageSent();
        // }
      });

      // Subscribe to error messages
      wsService.current.subscribeToErrors((errorMessage: string) => {
        setError(errorMessage);
      });

      // Subscribe to room status updates
      wsService.current.subscribeToUserOrMessageStatus(roomId, (update: UserStatusUpdate | MessageStatusUpdate) => {
        if ('type' in update && update.type === 'MESSAGE_STATUS_UPDATE') {
          handleMessageStatusUpdate(update);
        } else if ('username' in update) {
          handleUserStatusUpdate(update as UserStatusUpdate);
        }
      });

      console.log(`[ChatWindow] Connected to WebSocket and subscribed to room ${roomId}`);

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setError('Failed to connect to chat server');
      setWsConnected(false);

      setTimeout(() => {
        if (user && token) {
          connectWebSocket();
        }
      }, 3000);
    }
  };

  const handleUserStatusUpdate = useCallback((update: UserStatusUpdate) => {
    console.log('👤 User status update received:', update);

    // if (chatRoom && chatRoom.participants) {
      setChatRoom(prev => {
        if (!prev) return prev;
        
        const updatedParticipants = prev.participants?.map(participant => {
          if (participant.userId === update.userId) {
            return {
              ...participant,
              online: update.online,
              lastSeen: update.lastSeen
            };
          }
          return participant;
        });

        // Only update if something actually changed
        const hasChanges = prev.participants?.some(
          p => p.userId === update.userId && 
          (p.online !== update.online || p.lastSeen !== update.lastSeen)
        );

        if (!hasChanges) return prev;

        return {
          ...prev,
          participants: updatedParticipants
        };
      });
    // }
  }, []);

  const handleMessageStatusUpdate = useCallback((update: MessageStatusUpdate) => {
    console.log('📨 Message status update received:', update);

    setMessageStatuses(prev => {
      const newStatuses = new Map(prev);
      
      if (!newStatuses.has(update.messageId)) {
        newStatuses.set(update.messageId, new Map());
      }
      
      const messageStatusMap = newStatuses.get(update.messageId)!;
      messageStatusMap.set(update.userId, update.status as EnumStatus);
      
      return newStatuses;
    });
  }, []);

  const loadChatRoom = async () => {
    try {
      setError(null);
      const room = await ApiService.getChatRoomById(roomId);
      setChatRoom(room);
      
      // Notify parent about room creation if this is a new room
      // if (onRoomCreated) {
      //   onRoomCreated(room.id);
      // }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat room';
      setError(errorMessage);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const roomMessages = await ApiService.getMessagesByChatRoomId(roomId, {
        page: 0,
        size: 50,
        sort: 'timestamp,asc'
      });
      setMessages(roomMessages);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load messages';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !user || !wsConnected) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setSending(true);
      // wsService.current.sendTextMessage(roomId, messageContent);
      
      // Check if message contains only image URL(s)
      const urls = extractUrls(messageContent);
      const imageUrls = urls.filter(url => isImageUrl(url));
      const isOnlyImageUrl = imageUrls.length > 0 && 
                            messageContent === imageUrls.join(' ');
      
      // If message is only image URL(s), send as image message
      if (isOnlyImageUrl) {
        console.log(`[ChatWindow] Detected image URL(s), sending via sendImageFromUrl`);
        // Send first image URL (you can modify to handle multiple)
        wsService.current.sendImageFromUrl(roomId, imageUrls[0]);
      } else {
        // Send as regular text message (backend will extract URLs)
        wsService.current.sendTextMessage(roomId, messageContent);
      }
      
      console.log(`[ChatWindow] ✅ Message sent successfully`);

      // Notify parent to refresh sidebar
      // if (onMessageSent) {
      //   onMessageSent();
      // }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Helper function to extract URLs from text
  const extractUrls = (text: string): string[] => {
    const urlPattern = /\b(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)\b/gi;
    const matches = text.match(urlPattern);
    return matches || [];
  };

  // Helper function to check if URL is an image
  const isImageUrl = (url: string): boolean => {
    const lowerUrl = url.toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i.test(lowerUrl) ||
          lowerUrl.includes('/images/') ||
          (lowerUrl.includes('image') && lowerUrl.includes('cdn'));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !wsConnected) return;

    try {
      setSending(true);
      await wsService.current.sendImageMessage(roomId, file);
      
      // Notify parent to refresh sidebar
      // if (onMessageSent) {
      //   onMessageSent();
      // }
    } catch (error) {
      console.error('Failed to send image:', error);
      setError(error instanceof Error ? error.message : 'Failed to send image');
    } finally {
      setSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Function to handle GET different URL formats
  const getImageUrl = (url: string): string => {
    // console.log('Getting image URL for:', url);

    // If URL is already absolute (starts with http), use it as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If URL starts with /api, prepend the API base URL
    if (url.startsWith('/api')) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      return `${apiUrl}${url}`;
    }
    
    // Otherwise, return as-is
    return url;
  };

  const handleRoomUpdated = (updatedRoom: ChatRoomDTO) => {
    setChatRoom(updatedRoom);
    setShowOptionsMenu(false);
    loadChatRoom();
    loadMessages();
  };

  const handleRoomLeft = () => {
    setShowOptionsMenu(false);

    try {
      setChatRoom(null);
      setMessages([]);

      // if (wsService.current) {
      //   wsService.current.unsubscribeFromRoom(roomId);
      // }

      if (onBack) {
        onBack();
        setTimeout(() => {
          console.log('Navigate back to chat list');
          window.location.href = '/chat';
          // router.push('/chat');
        }, 300);
      }
    } catch (error) {
      console.error('Error handling room leave:', error);
      window.location.reload();
    }
  };

  const canSendMessage = () => {
    if (!user || !chatRoom || !currentUserParticipant) return false;
    
    if (chatRoom.type === EnumRoomType.CHANNEL) {
      return currentUserParticipant.role === EnumRoomRole.ADMIN;
    }
    
    return true;
  };

  const getMessageStatusIcon = (message: ChatMessageDTO) => {
    if (message.senderId !== user?.id) return null;

    const messageStatusMap = messageStatuses.get(message.id);
    if (!messageStatusMap || messageStatusMap.size === 0) {
      // return <CheckIcon className="w-3 h-3 text-gray-400" />;
      // Message just sent, no delivery confirmation yet
      return (
        <div className="flex items-center">
          <div className="w-2 h-2 bg-yellow-800 rounded-full" title="Sent"></div>
        </div>
      );
    }

    // Check if anyone has read the message
    const hasRead = Array.from(messageStatusMap.values()).some(status => status === EnumStatus.READ);
    if (hasRead) {
      // return <EyeIcon className="w-3 h-3 text-blue-500" />;
      return (
        <div className="flex items-center space-x-0.5" title="Read">
          {/* <CheckIcon className="w-3 h-3 text-yellow-500" />
          <CheckIcon className="w-3 h-3 text-yellow-500 -ml-1" /> */}
          <CheckCheck className="w-3 h-3 text-yellow-800" />
        </div>
      );
    }

    // Check if anyone has received the message
    const hasDelivered = Array.from(messageStatusMap.values()).some(status => status === EnumStatus.DELIVERED);
    if (hasDelivered) {
      // return <CheckCircleIcon className="w-3 h-3 text-green-500" />;
      return (
        <div className="flex items-center" title="Delivered">
          <CheckIcon className="w-3 h-3 text-yellow-800" />
        </div>
      );
    }

    // return <CheckIcon className="w-3 h-3 text-gray-400" />;
    // Default: just sent
    return (
      <div className="flex items-center">
        <div className="w-2 h-2 bg-yellow-800 rounded-full" title="Sent"></div>
      </div>
    );
  };

  // const renderMessage = (message: ChatMessageDTO) => {
  //   const isOwn = message.senderId === user?.id;
  //   const showSender = !isOwn && chatRoom?.type !== EnumRoomType.PERSONAL;

  //   if (message.type === EnumMessageType.SYSTEM) {
  //     return (
  //       <div key={message.id} className="flex justify-center mb-2">
  //         <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full max-w-xs text-center">
  //           {message.content}
  //         </div>
  //       </div>
  //     );
  //   }

  //   // Extract image and other URLs from attachments
  //   const imageAttachments = message.attachmentUrls?.filter(url => isImageUrl(url)) || [];
  //   const otherAttachments = message.attachmentUrls?.filter(url => !isImageUrl(url)) || [];

  //   return (
  //     <div
  //       key={message.id}
  //       data-message-id={message.id}
  //       ref={(el) => { // Add this ref
  //         if (el && intersectionObserver.current && !isOwn) {
  //           intersectionObserver.current.observe(el);
  //         }
  //       }}
  //       className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
  //     >
  //       {!isOwn && chatRoom?.type !== EnumRoomType.PERSONAL && (
  //         <div className="flex-shrink-0 mr-3">
  //           <Image
  //             alt={message.senderName || "group or channel default avatar"}
  //             src={message.senderAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.senderName || message.senderName)}&background=random`}
  //             width={32}
  //             height={32}
  //             className="rounded-full object-cover"
  //           />
  //         </div>
  //       )}

  //       <div
  //         className={`max-w-xs lg:max-w-md ${
  //           isOwn
  //             ? 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg'
  //             : 'bg-gray-200 text-gray-900 rounded-r-lg rounded-tl-lg'
  //         } px-4 py-2 shadow-sm`}
  //       >
  //         {showSender && (
  //           <div className="text-xs font-medium mb-1 text-blue-600">
  //             {message.senderName}
  //           </div>
  //         )}

  //         {/* Display image attachments */}
  //         {imageAttachments.length > 0 && (
  //           <div className="mb-2">
  //             {imageAttachments.map((url, index) => {
  //               const imageUrl = getImageUrl(url);
  //               return (
  //                 <div key={index} className="relative mb-2">
  //                   <Image
  //                     src={imageUrl}
  //                     alt={`Image ${index + 1}`}
  //                     width={300}
  //                     height={300}
  //                     className="max-w-full rounded cursor-pointer hover:opacity-90 object-contain"
  //                     style={{ maxHeight: '300px', width: 'auto' }}
  //                     onClick={() => window.open(imageUrl, '_blank')}
  //                     onError={(e) => {
  //                       console.error(`Failed to load image: ${imageUrl}`);
  //                       e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
  //                     }}
  //                   />
  //                   {/* ✅ Show URL below image */}
  //                   <a
  //                     href={imageUrl}
  //                     target="_blank"
  //                     rel="noopener noreferrer"
  //                     className={`text-xs ${isOwn ? 'text-blue-200' : 'text-blue-600'} hover:underline break-all`}
  //                   >
  //                     {url}
  //                   </a>
  //                 </div>
  //               );
  //             })}
  //           </div>
  //         )}

  //         {/* ✅ Display other URL attachments */}
  //         {otherAttachments.length > 0 && (
  //           <div className="mb-2">
  //             {otherAttachments.map((url, index) => (
  //               <div key={index} className="flex items-center space-x-2 mb-1">
  //                 <PaperClipIcon className="w-4 h-4" />
  //                 <a
  //                   href={url}
  //                   target="_blank"
  //                   rel="noopener noreferrer"
  //                   className={`text-sm ${isOwn ? 'text-blue-200' : 'text-blue-600'} hover:underline break-all`}
  //                 >
  //                   {url}
  //                 </a>
  //               </div>
  //             ))}
  //           </div>
  //         )}

  //         {/* ✅ Display text content (if not "Photo" placeholder) */}
  //         {message.content && message.content !== "Photo" && (
  //           <div className="whitespace-pre-wrap break-words">
  //             {renderContentWithLinks(message.content, isOwn)}
  //           </div>
  //         )}

  //         <div className="flex items-center justify-between mt-1">
  //           <div
  //             className={`text-xs ${
  //               isOwn
  //                 ? 'text-blue-200'
  //                 : 'text-gray-500'
  //             }`}
  //           >
  //             {formatMessageTime(message.timestamp)}
  //           </div>
            
  //           {isOwn && (
  //             <div className="ml-2">
  //               {getMessageStatusIcon(message)}
  //             </div>
  //           )}
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };

  // // Helper to render content with clickable links
  // const renderContentWithLinks = (content: string, isOwn: boolean) => {
  //   const urlPattern = /\b(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)\b/gi;
  //   const parts = content.split(urlPattern);
    
  //   return parts.map((part, index) => {
  //       if (part.match(urlPattern)) {
  //         return (
  //           <a
  //             key={index}
  //             href={part}
  //             target="_blank"
  //             rel="noopener noreferrer"
  //             className={`${isOwn ? 'text-blue-200' : 'text-blue-600'} hover:underline break-all`}
  //           >
  //             {part}
  //           </a>
  //         );
  //       }
  //       return <span key={index}>{part}</span>;
  //     })
  // };


  const renderMessage = (message: ChatMessageDTO) => {
    const isOwn = message.senderId === user?.id;
    const showSender = !isOwn && chatRoom?.type !== EnumRoomType.PERSONAL;

    if (message.type === EnumMessageType.SYSTEM) {
      return (
        <div key={message.id} className="flex justify-center mb-2">
          <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full max-w-xs text-center">
            {message.content}
          </div>
        </div>
      );
    }

    // ✅ Extract image and other URLs from attachments
    const imageAttachments = message.attachmentUrls?.filter(url => isImageUrl(url)) || [];
    const otherAttachments = message.attachmentUrls?.filter(url => !isImageUrl(url)) || [];

    // ✅ Check if image is from local server (localhost or application domain)
    const isLocalImage = (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('localhost') || 
              lowerUrl.includes('127.0.0.1') ||
              lowerUrl.startsWith('/api/') ||
              (process.env.NEXT_PUBLIC_API_URL ? lowerUrl.includes(process.env.NEXT_PUBLIC_API_URL) : false);
    };

    // ✅ Check if message is image-only (no text content except "Photo" placeholder)
    const isImageOnly = message.type === EnumMessageType.IMAGE && 
                        (!message.content || message.content === "Photo");

    return (
      <div
        key={message.id}
        data-message-id={message.id}
        ref={(el) => {
          if (el && intersectionObserver.current && !isOwn) {
            intersectionObserver.current.observe(el);
          }
        }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {!isOwn && chatRoom?.type !== EnumRoomType.PERSONAL && (
          <div className="flex-shrink-0 mr-3">
            <Image
              alt={message.senderName || "avatar"}
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(message.senderName || 'User')}&background=random`}
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          </div>
        )}

        <div
          className={`max-w-xs lg:max-w-md ${
            isOwn
              ? 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg'
              : 'bg-gray-200 text-gray-900 rounded-r-lg rounded-tl-lg'
          } px-4 py-2 shadow-sm`}
        >
          {showSender && (
            <div className="text-xs font-medium mb-1 text-blue-600">
              {message.senderName}
            </div>
          )}

          {/* ✅ Display image attachments */}
          {imageAttachments.length > 0 && (
            <div className="mb-2">
              {imageAttachments.map((url, index) => {
                const imageUrl = getImageUrl(url);
                const showImageUrl = !isImageOnly && !isLocalImage(url); // Only show URL if not image-only and not local
                
                return (
                  <div key={index} className="relative mb-2">
                    <Image
                      src={imageUrl}
                      alt={`Image ${index + 1}`}
                      width={300}
                      height={300}
                      className="max-w-full rounded cursor-pointer hover:opacity-90 object-contain"
                      style={{ maxHeight: '300px', width: 'auto' }}
                      onClick={() => window.open(imageUrl, '_blank')}
                      onError={(e) => {
                        console.error(`Failed to load image: ${imageUrl}`);
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                    
                    {/* ✅ Only show URL if: 1) Not image-only message, AND 2) Not from local server */}
                    {showImageUrl && (
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs ${isOwn ? 'text-blue-200' : 'text-blue-600'} hover:underline break-all mt-1 inline-block`}
                      >
                        {/* {url} */}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ✅ Display regular URL attachments (not images) - inline with text */}
          {otherAttachments.length > 0 && (
            <div className="mb-2">
              {otherAttachments.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isOwn ? 'text-blue-200' : 'text-blue-600'} hover:underline break-all inline`}
                >
                </a>
              ))}
            </div>
          )}

          {/* ✅ Display text content (if exists and not just "Photo" placeholder) */}
          {message.content && message.content !== "Photo" && (
            <div className="whitespace-pre-wrap break-words">
              {renderContentWithLinks(message.content, isOwn)}
            </div>
          )}

          <div className="flex items-center justify-between mt-1">
            <div className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
              {formatMessageTime(message.timestamp)}
            </div>
            
            {isOwn && (
              <div className="ml-2">
                {getMessageStatusIcon(message)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ✅ Helper to render content with clickable links (for text with embedded URLs)
  const renderContentWithLinks = (content: string, isOwn: boolean) => {
    const urlPattern = /\b(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)\b/gi;
    const parts = content.split(urlPattern);
    
    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`${isOwn ? 'text-blue-200 underline' : 'text-blue-600 underline'} hover:opacity-80 break-all`}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };


  // Handle User Status Online/Offline Indicator

  const getSubtitle = () => {
    if (!chatRoom) return '';
    
    // const wsStatus = wsService.current.getConnectionStatus();
    let statusIndicator = '';
    
    if (chatRoom.type === EnumRoomType.PERSONAL && chatRoom.participants) {
      const otherParticipant = chatRoom.participants.find(p => p.userId !== user?.id);
      
      if (otherParticipant) {
        // Use userStatus function
        const { text } = userStatus(otherParticipant.online, otherParticipant.lastSeen);
        statusIndicator = text;
        // statusIndicator = getOnlineStatus(otherParticipant.online, otherParticipant.lastSeen);
        // statusIndicator = userStatus(otherParticipant.online, otherParticipant.lastSeen).text;
      }

      // For personal, do NOT add websocket status to subtitle
      return statusIndicator;

    } else if (chatRoom.type === EnumRoomType.GROUP) {
      const memberCount = chatRoom.participants?.length || 0;
      const onlineCount = chatRoom.participants?.filter(p => p.online).length || 0;
      statusIndicator = `${memberCount} members, ${onlineCount} online`;

    } else if (chatRoom.type === EnumRoomType.CHANNEL) {
      const subscriberCount = chatRoom.participants?.length || 0;
      statusIndicator = `${subscriberCount} subscribers`;
    }

    // For group/channel, you may still want to show connection status
    const wsStatus = wsService.current.getConnectionStatus();
    return `${statusIndicator} • ${wsStatus}`;
  };

  if (error && !chatRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error loading chat</div>
          <div className="text-gray-500 text-sm mb-4">{error}</div>
          <button
            onClick={() => {
              setError(null);
              loadChatRoom();
              loadMessages();
              connectWebSocket();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-500">Authenticating...</div>
        </div>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Authentication Required</div>
          <div className="text-gray-500 text-sm mb-4">Please log in to access chat</div>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-500">Loading chat...</div>
        </div>
      </div>
    );
  }

  if (!chatRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">Chat room not found</div>
          <div className="text-gray-400 text-sm">The chat room you are looking for does not exist or you do not have access to it.</div>
        </div>
      </div>
    );
  }

  const displayName = getChatRoomDisplayName(chatRoom, user!);
  const avatarUrl = getChatRoomAvatar(chatRoom, user!);
  
  const isMessageInputDisabled = !canSendMessage();
  const messageInputPlaceholder = isMessageInputDisabled 
    ? `Only admins can send messages in this ${chatRoom.type.toLowerCase()}`
    : 'Type a message...';

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-black" />
              </button>
            )}
            
            <Image
              src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt={displayName}
              width={40}
              height={40}
              className="rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
              }}
            />

            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{displayName}</h2>
              <p className="text-sm text-gray-500 truncate">
                {getSubtitle()}
                {/* Show online/offline dot for personal chat */}
                {chatRoom?.type === EnumRoomType.PERSONAL && chatRoom.participants && (() => {
                  const other = chatRoom.participants.find(p => p.userId !== user?.id);
                  if (!other) return null;
                  const { dot } = userStatus(other.online, other.lastSeen);
                  return (
                    <span
                      className={`ml-2 inline-block w-2 h-2 rounded-full ${dot}`}
                      title={userStatus(other.online, other.lastSeen).text}
                    ></span>
                  );
                })()}
                {/* For group/channel, keep the ws dot */}
                {chatRoom && chatRoom.type !== EnumRoomType.PERSONAL && (
                  <span className={`ml-2 inline-block w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-green-500' : 
                    wsService.current.getConnectionStatus().includes('Reconnecting') ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}></span>
                )}

                {/* <span className={`ml-2 inline-block w-2 h-2 rounded-full 
                ${
                  wsConnected ? 'bg-green-500' : 
                  wsService.current.getConnectionStatus().includes('Reconnecting') ? 'bg-yellow-500' : 
                  'bg-red-500'
                }`}></span> */}

                {/* Show online/offline dot for personal chat */}
                {/* {chatRoom?.type === EnumRoomType.PERSONAL && chatRoom.participants && (() => {
                  const other = chatRoom.participants.find(p => p.userId !== user?.id);
                  if (!other) return null;
                  return (
                    <span
                      className={`ml-2 inline-block w-2 h-2 rounded-full ${other.online ? 'bg-green-500' : 'bg-gray-400'}`}
                      title={other.online ? 'Online' : 'Offline'}
                    ></span>
                  );
                })()} */}
                {/* For group/channel, you can keep the ws dot if you want */}
                {/* {chatRoom && chatRoom.type !== EnumRoomType.PERSONAL && (
                  <span className={`ml-2 inline-block w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-green-500' : 
                    wsService.current.getConnectionStatus().includes('Reconnecting') ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}></span>
                )} */}
              </p>
            </div>
          </div>

          {chatRoom && (chatRoom.type === EnumRoomType.GROUP || chatRoom.type === EnumRoomType.CHANNEL) && (
            <div className="relative">
              <button 
                onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <EllipsisVerticalIcon className="w-5 h-5 text-gray-600" />
              </button>

              <ChatRoomOptionsMenu
                chatRoom={chatRoom}
                isOpen={showOptionsMenu}
                onClose={() => setShowOptionsMenu(false)}
                onRoomUpdated={handleRoomUpdated}
                onRoomLeft={handleRoomLeft}
              />
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="mb-4">
              <PaperAirplaneIcon className="w-16 h-16 mx-auto text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-400 mb-2">No messages yet</h3>
            <p className="text-sm text-gray-400">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-800 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
        {chatRoom.type === EnumRoomType.CHANNEL && isMessageInputDisabled && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2 text-amber-800">
              <div className="text-sm">
                🔒 Only admins can send messages in this channel
              </div>
            </div>
          </div>
        )}

        <div className="flex items-end space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || !wsConnected || isMessageInputDisabled}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PhotoIcon className="w-6 h-6" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={messageInputPlaceholder}
              rows={1}
              disabled={!wsConnected || isMessageInputDisabled}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 text-black"
              style={{ minHeight: '40px' }}
            />
            
            <button
              className="absolute right-3 bottom-2 p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              disabled={isMessageInputDisabled}
              onClick={() => {
                console.log('Open emoji picker');
              }}
            >
              <FaceSmileIcon className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || !wsConnected || isMessageInputDisabled}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <div className="w-6 h-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            ) : (
              <PaperAirplaneIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}