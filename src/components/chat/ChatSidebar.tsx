'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { 
  ChatRoomDTO, 
  ChatFilter, 
  SearchFilter, 
  EnumRoomType,
  ParticipantDTO,
  ChatRoomBroadcast,
  ParticipantAddedBroadcast,
  AddedToChatRoomBroadcast,
  MessageStatusUpdate,
  EnumStatus,
  UserStatusUpdate,
  ChatMessageDTO
} from '@/types/chat';
import { User } from '@/types/user';
import { 
  getChatRoomAvatar, 
  getChatRoomDisplayName, 
  formatMessageTime, 
  truncateMessage, 
  getMessagePreview,
  getOnlineStatus,
  userStatus
} from '@/lib/chat-utils';
import { WebSocketService } from '@/lib/websocket';
import { 
  Bars3Icon, 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  UserGroupIcon,
  SpeakerWaveIcon,
  XMarkIcon,
  PlusIcon,
  Cog6ToothIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import CreateGroupModal from './CreateGroupModal';
import CreateChannelModal from './CreateChannelModal';
import Image from 'next/image';

interface ChatSidebarProps {
  selectedRoomId?: number;
  onRoomSelect: (roomId: number) => void;
  onRoomCreated?: (roomId: number) => void;
  onRefreshNeeded?: () => void;
}

interface SearchResult {
  type: 'chat' | 'internal_friend' | 'external_friend' | 'channel';
  data: ChatRoomDTO | ParticipantDTO | User;
  id: number;
  name: string;
  avatar?: string;
  subtitle?: string;
}

export interface ChatSidebarRef {
  refreshChatRooms: () => void;
}

export default function ChatSidebar({ selectedRoomId, onRoomSelect }: ChatSidebarProps) {
// const ChatSidebar = forwardRef<ChatSidebarRef, ChatSidebarProps>(
  // ({ selectedRoomId, onRoomSelect, onRoomCreated, onRefreshNeeded }, ref) => {
  const { user, token } = useAuth();
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoomDTO[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoomDTO[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('CHATS');
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const wsService = useRef(WebSocketService.getInstance());
  const [wsInitialized, setWsInitialized] = useState(false);

  // Add a state to track global WebSocket subscription
  const [globalWSInitialized, setGlobalWSInitialized] = useState(false);

  // Add state to track online status
  const [isOnline, setIsOnline] = useState(true);
  const lastRequestedOnlineStatus = useRef<boolean | null>(null);
  const onlineStatusTimeout = useRef<NodeJS.Timeout | null>(null);

  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (user && token) {
      // initial load: show loading indicator
      loadChatRooms(true);
      // Set user online when component mounts
      updateUserOnlineStatus(true);
    }

    // Cleanup function for when component unmounts or user changes
    return () => {
      if (user) {
        updateUserOnlineStatus(false);
      }
    };
  }, [user, token]);

  // Handle browser/tab close and page visibility
  useEffect(() => {
    if (!user) return;

    // Handle page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden (minimized, switched tab, etc.)
        updateUserOnlineStatus(false);
      } else {
        // Page is visible again
        updateUserOnlineStatus(true);
      }
    };

    // Handle browser/tab close
    const handleBeforeUnload = () => {
      if (user) {
        // Use sendBeacon for reliability during page unload
        navigator.sendBeacon(
          `/api/participants/user/${user.id}/online?online=false`,
          JSON.stringify({ online: false })
        );
      }
    };

    // Handle browser online/offline status
    const handleOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (user) {
        updateUserOnlineStatus(online);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, [user]);

  // Separate effect for GLOBAL WebSocket connection (not room-specific)
  useEffect(() => {
    if (user && token && !globalWSInitialized && !loading) {
      connectGlobalWebSocket();
      setGlobalWSInitialized(true);
    }
  }, [user, token, globalWSInitialized, loading]);

  // Add a periodic refresh to catch missed updates
  useEffect(() => {
    if (wsConnected && user) {
      const refreshInterval = setInterval(() => {
        // console.log('[ChatSidebar] Periodic refresh of chat rooms');
        loadChatRooms(false); // Refresh chat rooms
        refreshUserStatus(); // Refresh user status
      }, 5000); // Refresh in seconds
      
      return () => clearInterval(refreshInterval);
    }
  }, [wsConnected, user]);

  // Track selected room for read status updates
  useEffect(() => {
    if (selectedRoomId && user) {
      // When a room is selected, we could mark messages as read
      // This would typically be handled by the ChatWindow component
      // but we can also track room selection here
      handleRoomSelection(selectedRoomId);

      // Clear unread count for selected room
      setUnreadCounts(prev => {
        const newCounts = new Map(prev);
        newCounts.delete(selectedRoomId);
        return newCounts;
      });
    }
  }, [selectedRoomId, user]);

  // Debouncing effect for search query
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 1000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Search execution effect
  useEffect(() => {
    if (showSearch && debouncedSearchQuery.trim()) {
      handleSearch();
    } else {
      filterRooms();
    }
  }, [chatRooms, activeFilter, debouncedSearchQuery, searchFilter, showSearch]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        setShowMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  // Expose the refresh method via ref
  // useImperativeHandle(ref, () => ({
  //   refreshChatRooms: loadChatRooms
  // }));

  // Load unread counts when chat rooms change
  useEffect(() => {
    if (chatRooms.length > 0 && user) {
      loadUnreadCounts();
    }
  }, [chatRooms, user]);

  // Handle Message Statuses

  // Load unread message counts
  const loadUnreadCounts = async () => {
    if (!user) return;

    try {
      const counts = new Map<number, number>();
      
      for (const room of chatRooms) {
        if (room.lastMessageId && room.lastMessageId > 0) {
          try {
            // Only check unread status if the current user is NOT the sender of the last message
            // Get the last message details to check who sent it
            const lastMessage = await ApiService.getMessageById(room.lastMessageId);
            
            // If current user sent the last message, don't show unread badge
            if (lastMessage.senderId === user.id) {
              continue;
            }
            
            // Check if user has read the last message
            const status = await ApiService.getMessageStatusByUserAndMessage(user.id, room.lastMessageId, true);

            // console.log(`[ChatSidebar] Message status for user ${user.id}, message ${room.lastMessageId} in room ${room.id}:`, status);
            
            // If no read status found or status is not READ, count as unread
            if (!status || status.status !== EnumStatus.READ) {
              // For simplicity, we'll count 1 unread message per room
              // In a real implementation, you'd want to count all unread messages
              counts.set(room.id, 1);
            }
          } catch (error) {
            // If status doesn't exist and current user didn't send the message, consider it unread
            console.log(`[ChatSidebar] No status found for room ${room.id}, message ${room.lastMessageId}`);
            // We need to check who sent the last message first
            try {
              const lastMessage = await ApiService.getMessageById(room.lastMessageId);
              if (lastMessage.senderId !== user.id) {
                counts.set(room.id, 1);
              }
            } catch (msgError) {
              console.error('Failed to get last message details:', msgError);
            }
          }
        }
      }
      
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  };

  // Update last read message for a room
  const updateLastReadMessage = async (roomId: number, messageId: number) => {
    if (!user) return;

    try {
      await ApiService.updateLastReadMessageId(user.id, roomId, messageId);
      console.log(`[ChatSidebar] Updated last read message for room ${roomId}, message ${messageId}`);

      // Clear unread count for this room
      setUnreadCounts(prev => {
        const newCounts = new Map(prev);
        newCounts.delete(roomId);
        return newCounts;
      });
      
      // Refresh chat rooms to update unread counts
      loadChatRooms(false);
    } catch (error) {
      console.error('Failed to update last read message:', error);
    }
  };

  // Handle room selection and potentially mark as read
  const handleRoomSelection = (roomId: number) => {
    // Find the selected room
    const room = chatRooms.find(r => r.id === roomId);
    if (room && room.lastMessageId) {
      // Update last read message to the latest message in the room
      updateLastReadMessage(roomId, room.lastMessageId);
    }
  };


  // Handle User Status Updates

  // Update user online status
  const updateUserOnlineStatus = async (online: boolean) => {
    if (!user) return;

    // Save the latest requested status
    lastRequestedOnlineStatus.current = online;

    // Clear any existing timer
    if (onlineStatusTimeout.current) {
      clearTimeout(onlineStatusTimeout.current);
    }

    // Set a new timer
    onlineStatusTimeout.current = setTimeout(async () => {
      // Only update if the status hasn't changed in the last 5 seconds
      if (lastRequestedOnlineStatus.current === online) {
        try {
          const result = await ApiService.updateOnlineStatus(user.id, online);
          setIsOnline(online);
          console.log(`[ChatSidebar] User ${user.username} status updated to: ${online ? 'online' : 'offline'}`);
          // console.log(`[ChatSidebar] Participant API response:`, result);
          
        } catch (error) {
          console.error('Failed to update online status:', error);
          setIsOnline(false);
        }
      }
    }, 5000);
  };

  // Add this function inside ChatSidebar component
  const refreshUserStatus = async () => {
    if (!user) return;
    
    try {
      // Silently refresh chat rooms to get updated participant status
      const rooms = await ApiService.getChatRoomsByUserId(user.id);
      setChatRooms(rooms);
    } catch (error) {
      console.error('Failed to refresh user status:', error);
    }
  };


  // Handle websocket connections and subscriptions

  // Global WebSocket connection for cross-room updates
  const connectGlobalWebSocket = async () => {
    if (!user || !token) return;

    try {
      if (wsService.current.isWebSocketConnected()) {
        setWsConnected(true);
        setupGlobalWebSocketHandlers();
        return;
      }

      await wsService.current.connect(token);
      setWsConnected(true);
      setError(null);
      setupGlobalWebSocketHandlers();
    } catch (error) {
      console.error('Global WebSocket connection failed:', error);
      setWsConnected(false);
      setError('Failed to connect to real-time updates');
    }
  };

  // const connectWebSocket = async () => {
  //   if (!user || !token) return;

  //   try {
  //     if (wsService.current.isWebSocketConnected()) {
  //       setWsConnected(true);
  //       setupWebSocketHandlers();
  //       return;
  //     }

  //     await wsService.current.connect(token);
  //     setWsConnected(true);
  //     setError(null);
  //     setupWebSocketHandlers();
  //   } catch (error) {
  //     console.error('WebSocket connection failed:', error);
  //     setWsConnected(false);
  //     setError('Failed to connect to real-time updates');
  //   }
  // };

  // setupWebSocketHandlers : Setup GLOBAL WebSocket handlers that work across all rooms
  const setupGlobalWebSocketHandlers = () => {
    console.log('[ChatSidebar] Setting up global WebSocket handlers');

    // Subscribe to new chat room creation
    wsService.current.subscribeToNewChatRoom((update: ChatRoomBroadcast | AddedToChatRoomBroadcast) => {
      if (update.type === 'NEW_CHAT_ROOM') {
        subscribeToNewChatRoom(update);
        loadChatRooms(false);
        // if (onRefreshNeeded) {
        //   onRefreshNeeded();
        // }
      } else if (update.type === 'ADDED_TO_CHAT_ROOM') {
        handleAddedToChatRoom(update);
        loadChatRooms(false);
        // if (onRefreshNeeded) {
        //   onRefreshNeeded();
        // }
      }
    });

    // Subscribe to ALL message updates globally (for sidebar refresh)
    wsService.current.subscribeToGlobalMessageNotifications?.((notification: ChatMessageDTO) => {
      console.log('[ChatSidebar] Received global message notification:', notification);
      handleGlobalMessageNotification(notification);
      loadChatRooms(false); // Refresh to update last message
      // if (onRefreshNeeded) {
      //   onRefreshNeeded();
      // }

      // // Update unread count for the room (if not currently selected)
      // if (selectedRoomId !== notification.chatRoomId) {
      //   setUnreadCounts(prev => {
      //     const newCounts = new Map(prev);
      //     const currentCount = newCounts.get(notification.chatRoomId) || 0;
      //     newCounts.set(notification.chatRoomId, currentCount + 1);
      //     return newCounts;
      //   });
      // }

      // Only update unread count if current user is NOT the sender and not in the selected room
      if (user && notification.senderId !== user.id && selectedRoomId !== notification.chatRoomId) {
        setUnreadCounts(prev => {
          const newCounts = new Map(prev);
          const currentCount = newCounts.get(notification.chatRoomId) || 0;
          newCounts.set(notification.chatRoomId, currentCount + 1);
          return newCounts;
        });
      }
    });

    // Subscribe to ALL participant additions across rooms
    wsService.current.subscribeToErrors((errorMessage: string) => {
      setError(errorMessage);
    });

    // Subscribe to global user status updates
    wsService.current.subscribeToUserOrMessageStatus(0, (update: UserStatusUpdate | MessageStatusUpdate) => {
      if ('type' in update && update.type === 'MESSAGE_STATUS_UPDATE') {
        // Handle message status updates globally
        handleGlobalMessageUpdate(update);
        
      } else if ('username' in update) {
        // Handle user status updates globally
        handleGlobalUserStatusUpdate(update as UserStatusUpdate);
        loadChatRooms(false);
      }
    });

    // Subscribe to participant additions (when users are added to groups)
    // This will be called after a new chat room is created and participants are added
    wsService.current.subscribeParticipantsAdded = (chatRoomId: number, onUpdate: (update: ParticipantAddedBroadcast) => void) => {
      wsService.current.subscribeParticipantsAdded(chatRoomId, (update: ParticipantAddedBroadcast) => {
        if (update.type === 'PARTICIPANT_ADDED') {
          subscribeParticipantsAdded(update);
          loadChatRooms(false);
          // if (onRefreshNeeded) {
          //   onRefreshNeeded();
          // }
        }
      });
    };
  };

  const handleGlobalMessageNotification = (message: ChatMessageDTO) => {
    // If the message is for the currently selected room, mark it as read
    if (selectedRoomId && message.chatRoomId === selectedRoomId) {
      updateLastReadMessage(message.chatRoomId, message.id);
    }
  };

  // Handle global message updates (affects last message in sidebar)
  const handleGlobalMessageUpdate = (update: MessageStatusUpdate) => {
    // If a message status was updated to READ, refresh unread counts
    if (update.status === EnumStatus.READ) {
      loadUnreadCounts();
    }

    // This will trigger a refresh of chat rooms to update last message timestamps
    loadChatRooms(false);
    // if (onRefreshNeeded) {
    //   onRefreshNeeded();
    // }
  };

  // Handle global user status updates
  const handleGlobalUserStatusUpdate = (update: UserStatusUpdate) => {
    setChatRooms(prev => prev.map(room => {
      if (room.participants) {
        const updatedParticipants = room.participants.map(participant => {
          if (participant.userId === update.userId) {
            return {
              ...participant,
              online: update.online,
              lastSeen: update.lastSeen
            };
          }
          return participant;
        });
        return { ...room, participants: updatedParticipants };
      }
      return room;
    }));
  };


  // Handle WebSocket subscriptions and updates

  const subscribeToNewChatRoom = (update: ChatRoomBroadcast) => {
    const newRoom = update.chatRoom;
    
    setChatRooms(prevRooms => {
      const exists = prevRooms.some(room => room.id === newRoom.id);
      if (exists) return prevRooms;
      
      return [newRoom, ...prevRooms];
    });

    // Notify parent about new room creation
    // if (onRoomCreated) {
    //   onRoomCreated(newRoom.id);
    // }

    setError(`✅ New chat room "${newRoom.name}" created`);
    setTimeout(() => setError(null), 3000);
  };

  const handleAddedToChatRoom = async (update: AddedToChatRoomBroadcast) => {
    try {
      const newRoom = await ApiService.getChatRoomById(update.chatRoomId);
      
      setChatRooms(prev => {
        const exists = prev.some(room => room.id === newRoom.id);
        if (exists) return prev;
        return [newRoom, ...prev];
      });

      setError(`✅ You were added to "${newRoom.name}" by ${update.addedBy}`);
      setTimeout(() => setError(null), 5000);
      
    } catch (error) {
      console.error('Failed to fetch new chat room:', error);
      setError('Failed to load new chat room details');
    }
  };

  const subscribeParticipantsAdded = (update: ParticipantAddedBroadcast) => {
    setChatRooms(prev => prev.map(room => {
      if (room.id === update.chatRoomId) {
        const updatedParticipants = room.participants ? [...room.participants, update.participant] : [update.participant];
        return { ...room, participants: updatedParticipants };
      }
      return room;
    }));
  };

  // const subscribeToUserOrMessageStatus = (update: MessageStatusUpdate) => {
  //   if (update.type === 'MESSAGE_STATUS_UPDATE' && update.status === EnumStatus.DELIVERED) {
  //     // Handle message delivery status
  //     console.log('Message delivered:', update);
  //   }
  // };

  // Helper functions

  const handleManualRefresh = async () => {
    await loadChatRooms(true);
    await loadUnreadCounts();
  };

  const loadChatRooms = async (showLoading = true) => {
    if (!user) return;
    
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const rooms = await ApiService.getChatRoomsByUserId(user.id);
      setChatRooms(rooms);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat rooms';
      setError(errorMessage);
      console.error('Failed to load chat rooms:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const filterRooms = () => {
    filterRoomsWithRooms(chatRooms);
  };

  const filterRoomsWithRooms = (rooms: ChatRoomDTO[]) => {
    let filtered = rooms;

    if (activeFilter !== 'ALL') {
      const roomType = activeFilter as keyof typeof EnumRoomType;
      filtered = filtered.filter(room => room.type === EnumRoomType[roomType]);
    }

    setFilteredRooms([...filtered]);
  };

  const handleSearch = async () => {
    if (!debouncedSearchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const query = debouncedSearchQuery.toLowerCase();
      const results: SearchResult[] = [];

      switch (searchFilter) {
        case 'CHATS':
          const filteredChats = chatRooms.filter(room => {
            const displayName = getChatRoomDisplayName(room, user).toLowerCase();
            return displayName.includes(query) || room.name.toLowerCase().includes(query);
          });
          
          results.push(...filteredChats.map(room => ({
            type: 'chat' as const,
            data: room,
            id: room.id,
            name: getChatRoomDisplayName(room, user),
            avatar: getChatRoomAvatar(room, user),
            subtitle: room.lastMessageContent 
              ? getMessagePreview(room.lastMessageContent, room.lastMessageType!, room.lastMessageAttachmentCount)
              : 'No messages yet'
          })));
          break;
          
        case 'MESSAGES':
          try {
            const searchResults = await ApiService.searchMessages(query);
            const roomIdsWithMessages = new Set(searchResults.map(msg => msg.chatRoomId));
            const roomsWithMessages = chatRooms.filter(room => roomIdsWithMessages.has(room.id));
            
            results.push(...roomsWithMessages.map(room => ({
              type: 'chat' as const,
              data: room,
              id: room.id,
              name: getChatRoomDisplayName(room, user),
              avatar: getChatRoomAvatar(room, user),
              subtitle: 'Found in messages'
            })));
          } catch (error) {
            console.error('Message search error:', error);
          }
          break;
          
        case 'FRIENDS':
          if (query.startsWith('@')) {
            const username = query.substring(1);
            if (username.trim()) {
              try {
                const externalUser = await ApiService.getUserByUsername(username);
                
                if (externalUser.id !== user.id) {
                  results.push({
                    type: 'external_friend' as const,
                    data: externalUser,
                    id: externalUser.id,
                    name: externalUser.fullName || externalUser.username,
                    avatar: externalUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(externalUser.fullName || externalUser.username)}&background=random`,
                    subtitle: `@${externalUser.username} • External User`
                  });
                }
              } catch (error) {
                console.error('External user search error:', error);
              }
            }
          } else {
            try {
              const personalPartners = await ApiService.getPersonalChatPartners(user.id);
              
              const filteredPartners = personalPartners.filter(partner => 
                partner.fullName?.toLowerCase().includes(query) ||
                partner.username?.toLowerCase().includes(query)
              );
              
              results.push(...filteredPartners.map(partner => ({
                type: 'internal_friend' as const,
                data: partner,
                id: partner.userId,
                name: partner.fullName || partner.username,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(partner.fullName || partner.username)}&background=random`,
                subtitle: `@${partner.username} • ${userStatus(partner.online, partner.lastSeen).text}`
              })));
            } catch (error) {
              console.error('Personal chat partners search error:', error);
            }
          }
          break;
          
        case 'CHANNELS':
          const channels = chatRooms.filter(room => 
            room.type === EnumRoomType.CHANNEL && 
            room.name.toLowerCase().includes(query)
          );
          
          results.push(...channels.map(room => ({
            type: 'channel' as const,
            data: room,
            id: room.id,
            name: room.name,
            avatar: getChatRoomAvatar(room, user),
            subtitle: `${room.participants?.length || 0} subscribers`
          })));
          break;
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchResultClick = async (result: SearchResult) => {
    if (result.type === 'chat' || result.type === 'channel') {
      handleRoomClick(result.id);
    } else if (result.type === 'internal_friend' || result.type === 'external_friend') {
      try {
        setSearchLoading(true);
        const personalChatRoom = await ApiService.createOrFindPersonalChat(result.id, user!.id);
        
        const existingRoom = chatRooms.find(room => room.id === personalChatRoom.id);
        if (!existingRoom) {
          setChatRooms(prev => [personalChatRoom, ...prev]);
        }
        
        handleRoomClick(personalChatRoom.id);
        
        setSearchQuery('');
        setDebouncedSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
      } catch (error) {
        console.error('Failed to create/find personal chat:', error);
        setError(error instanceof Error ? error.message : 'Failed to start chat');
      } finally {
        setSearchLoading(false);
      }
    }
  };

  const getChatTypeIcon = (type: EnumRoomType) => {
    switch (type) {
      case EnumRoomType.PERSONAL:
        return <UserIcon className="w-5 h-5" />;
      case EnumRoomType.GROUP:
        return <UserGroupIcon className="w-5 h-5" />;
      case EnumRoomType.CHANNEL:
        return <SpeakerWaveIcon className="w-5 h-5" />;
      default:
        return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
    }
  };

  const handleRoomClick = (roomId: number) => {
    onRoomSelect(roomId);
    router.push(`/chat/${roomId}`);

    // Update last read message when room is clicked
    const room = chatRooms.find(r => r.id === roomId);
    if (room && room.lastMessageId) {
      updateLastReadMessage(roomId, room.lastMessageId);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleCreateNewChat = (type: 'GROUP' | 'CHANNEL') => {
    setShowMenu(false);
    
    if (type === 'GROUP') {
      setShowCreateGroupModal(true);
    } else if (type === 'CHANNEL') {
      setShowCreateChannelModal(true);
    }
  };

  const handleGroupCreated = async (groupId: number) => {
    try {
      setShowCreateGroupModal(false);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh chat rooms to show the new group
      await loadChatRooms(true);

      // Notify parent about the new room
      // if (onRoomCreated) {
      //   onRoomCreated(groupId);
      // }

      handleRoomClick(groupId);
    } catch (error) {
      console.error('Error handling group creation:', error);
      setError('Failed to navigate to new group.');
    }
  };

  const handleChannelCreated = async (channelId: number) => {
    try {
      setShowCreateChannelModal(false);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh chat rooms to show the new channel
      await loadChatRooms(true);
      
      // Notify parent about the new room
      // if (onRoomCreated) {
      //   onRoomCreated(channelId);
      // }

      handleRoomClick(channelId);
    } catch (error) {
      console.error('Error handling channel creation:', error);
      setError('Failed to navigate to new channel.');
    }
  };

  const handleMyProfile = () => {
    setShowMenu(false);
    router.push('/profile');
  };

  const handleSettings = () => {
    setShowMenu(false);
    router.push('/settings');
  };

  const handleSearchToggle = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setSearchResults([]);
    }
  };

  // Update UI:
 
  // The WebSocket status indicator to show both WS and online status
  const getConnectionStatusColor = () => {
    if (!isOnline) return 'bg-red-500'; // Offline
    if (!wsConnected) return 'bg-yellow-500'; // Online but WS disconnected
    return 'bg-green-500'; // Online and connected
  };

  const getConnectionStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!wsConnected) return 'Connecting';
    return 'Live';
  };

  if (error && error.includes('Failed to load chat rooms')) {
    return (
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 text-center">
          <div className="text-red-500 text-sm mb-2">Error loading chats</div>
          <button 
            onClick={() => {
              setError(null);
              loadChatRooms(true);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const displayItems = showSearch && debouncedSearchQuery.trim() ? searchResults : 
      filteredRooms.map(room => ({
        type: 'chat' as const,
        data: room,
        id: room.id,
        name: getChatRoomDisplayName(room, user!),
        avatar: getChatRoomAvatar(room, user!),
        subtitle: room.lastMessageContent 
          ? truncateMessage(getMessagePreview(room.lastMessageContent, room.lastMessageType!, room.lastMessageAttachmentCount), 35)
          : 'No messages yet'
      }));

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          {/* Hamburger Menu */}
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bars3Icon className="w-6 h-6 text-gray-600" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="py-2">
                  <button 
                    onClick={handleMyProfile}
                    className="w-full px-4 py-2 text-left hover:bg-gray-500 text-sm flex items-center text-black"
                  >
                    <UserIcon className="w-4 h-4 mr-2" />
                    My Profile
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={() => handleCreateNewChat('GROUP')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-500 text-sm flex items-center text-black"
                  >
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    New Group
                  </button>
                  <button 
                    onClick={() => handleCreateNewChat('CHANNEL')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-500 text-sm flex items-center text-black"
                  >
                    <SpeakerWaveIcon className="w-4 h-4 mr-2" />
                    New Channel
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={handleSettings}
                    className="w-full px-4 py-2 text-left hover:bg-gray-500 text-sm flex items-center text-black"
                  >
                    <Cog6ToothIcon className="w-4 h-4 mr-2" />
                    Settings
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Toggle */}
          <button
            onClick={handleSearchToggle}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MagnifyingGlassIcon className="w-6 h-6 text-gray-600" />
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh chat list"
          >
            <ArrowPathIcon className="w-5 h-5 text-gray-600" />
          </button>

          {/* WebSocket Status Indicator */}
          <div className="flex items-center space-x-1">
            {/* <span className={`inline-block w-2 h-2 rounded-full ${
              wsConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span className="text-xs text-gray-500">
              {wsConnected ? 'Live' : 'Offline'}
            </span> */}
            {/* <span className={`inline-block w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></span>
            <span className="text-xs text-gray-500">
              {getConnectionStatusText()}
            </span> */}
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder={
                  searchFilter === 'FRIENDS' 
                    ? 'Search friends or @username for specific user...' 
                    : searchFilter === 'MESSAGES'
                    ? 'Search in messages...'
                    : searchFilter === 'CHANNELS'
                    ? 'Search channels...'
                    : 'Search chats...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
              />
              <MagnifyingGlassIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              {searchLoading ? (
                <div className="absolute right-2 top-2.5">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                </div>
              ) : (
                <button
                  onClick={handleSearchToggle}
                  className="absolute right-2 top-2.5 hover:bg-gray-100 rounded"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Search Filter Tabs */}
            <div className="flex space-x-1 text-xs">
              {(['CHATS', 'MESSAGES', 'FRIENDS', 'CHANNELS'] as SearchFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSearchFilter(filter)}
                  className={`px-3 py-1 rounded transition-colors ${
                    searchFilter === filter
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search Hints */}
            {searchFilter === 'FRIENDS' && (
              <div className="text-xs text-gray-500 px-2">
                {searchQuery.startsWith('@') ? 
                  'Searching for specific username...' : 
                  'Searching in your personal chat partners. Use @username to find specific users.'
                }
              </div>
            )}
          </div>
        )}

        {/* Chat Filter Buttons - Only show when not searching */}
        {!showSearch && (
          <div className="flex space-x-1 mt-4">
            {(['ALL', 'PERSONAL', 'GROUP', 'CHANNEL'] as ChatFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex-1 flex items-center justify-center py-2 px-2 rounded-lg text-xs transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {filter === 'ALL' && <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />}
                {filter === 'PERSONAL' && <UserIcon className="w-4 h-4 mr-1" />}
                {filter === 'GROUP' && <UserGroupIcon className="w-4 h-4 mr-1" />}
                {filter === 'CHANNEL' && <SpeakerWaveIcon className="w-4 h-4 mr-1" />}
                <span className="hidden sm:inline">
                  {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading chats...
          </div>
        ) : displayItems.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="mb-2">
              {showSearch && debouncedSearchQuery ? 
                (searchFilter === 'FRIENDS' && !debouncedSearchQuery.startsWith('@') ? 
                  'No personal chat partners found.' : 
                  searchFilter === 'FRIENDS' && debouncedSearchQuery.startsWith('@') ?
                  'User not found. Check the username.' :
                  'No results found'
                ) : 
                'No chats available'
              }
            </div>
            {!showSearch && !debouncedSearchQuery && (
              <button
                onClick={() => setShowMenu(true)}
                className="text-blue-500 hover:text-blue-600 text-sm flex items-center justify-center mx-auto"
              >
                <PlusIcon className="w-4 h-4 mr-1" />
                Start a new chat
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {displayItems.map((item, index) => (
              <div
                key={`${item.type}-${item.id}-${index}`}
                onClick={() => 
                  item.type === 'chat' || item.type === 'channel' ? 
                    handleRoomClick(item.id) : 
                    handleSearchResultClick(item)
                }
                className={`p-3 hover:bg-gray-100 cursor-pointer border-l-4 transition-colors ${
                  selectedRoomId === item.id && (item.type === 'chat' || item.type === 'channel')
                    ? 'bg-blue-50 border-blue-500'
                    : 'border-transparent'
                } ${searchLoading && (item.type === 'internal_friend' || item.type === 'external_friend') ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {/* <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`;
                      }}
                    /> */}
                    <Image
                      src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`}
                      alt={item.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full object-cover"
                      unoptimized={item.avatar?.includes('ui-avatars.com')}
                    />

                    {/* Show indicators based on type */}
                    {item.type === 'internal_friend' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                    {item.type === 'external_friend' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-400 border-2 border-white rounded-full"></div>
                    )}
                    {/* Show online/offline indicator for personal chat rooms */}
                    {item.type === 'chat' && (item.data as ChatRoomDTO).type === EnumRoomType.PERSONAL && (() => {
                      // Find the other participant (not current user)
                      const room = item.data as ChatRoomDTO;
                      const other = room.participants?.find(p => p.userId !== user?.id);
                      if (!other) return null;
                      // const { dot: statusDotClass } = userStatus(other.online, other.lastSeen);
                      const { dot } = userStatus(other.online, other.lastSeen);
                      return (
                        <div
                          className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${dot}`}
                          title={userStatus(other.online, other.lastSeen).text}
                        ></div>
                        // <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${statusDotClass}`}></div>
                        // <div
                        //   className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${other.online ? 'bg-green-500' : 'bg-gray-400'}`}
                        //   title={other.online ? 'Online' : 'Offline'}
                        // ></div>
                      );
                    })()}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">

                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {item.name}
                      </h3>
                      {/* {item.type === 'chat' && (item.data as ChatRoomDTO).lastMessageTimestamp && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatMessageTime((item.data as ChatRoomDTO).lastMessageTimestamp!)}
                        </span>
                      )} */}
                      
                      <div className="flex items-center space-x-2">
                        {/* Unread count badge */}
                        {item.type === 'chat' && unreadCounts.has(item.id) && unreadCounts.get(item.id)! > 0 && (
                          <div className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                            {unreadCounts.get(item.id)}
                          </div>
                        )}
                        {/* Existing timestamp */}
                        {item.type === 'chat' && (item.data as ChatRoomDTO).lastMessageTimestamp && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatMessageTime((item.data as ChatRoomDTO).lastMessageTimestamp!)}
                          </span>
                        )}
                      </div>

                    </div>
                    <div className="flex items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      {/* Type indicator */}
                      <div className="flex-shrink-0 ml-2">
                        {item.type === 'chat' && getChatTypeIcon((item.data as ChatRoomDTO).type)}
                        {item.type === 'channel' && <SpeakerWaveIcon className="w-4 h-4 text-gray-400" />}
                        {item.type === 'internal_friend' && <UserIcon className="w-4 h-4 text-green-500" />}
                        {item.type === 'external_friend' && <UserIcon className="w-4 h-4 text-blue-400" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Toast */}
      {/* {error && (
        <div className={`p-2 border-t ${error.startsWith('✅') ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${error.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{error}</span>
            <button
              onClick={() => setError(null)}
              className={`${error.startsWith('✅') ? 'text-green-800 hover:text-green-900' : 'text-red-800 hover:text-red-900'}`}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )} */}

      {/* Render modals */}
      {showCreateGroupModal && (
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={handleGroupCreated}
        />
      )}

      {showCreateChannelModal && (
        <CreateChannelModal
          isOpen={showCreateChannelModal}
          onClose={() => setShowCreateChannelModal(false)}
          onChannelCreated={handleChannelCreated}
        />
      )}
    </div>
  );
};
// });

// Add display name for better debugging
// ChatSidebar.displayName = 'ChatSidebar';

// export default ChatSidebar;