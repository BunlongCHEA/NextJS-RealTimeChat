'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { 
  ChatRoomDTO, 
  ChatFilter, 
  SearchFilter, 
  EnumRoomType,
  ParticipantDTO
} from '@/types/chat';
import { User } from '@/types/user';
import { 
  getChatRoomAvatar, 
  getChatRoomDisplayName, 
  formatMessageTime, 
  truncateMessage, 
  getMessagePreview 
} from '@/lib/chat-utils';
import { 
  Bars3Icon, 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  UserGroupIcon,
  SpeakerWaveIcon,
  XMarkIcon,
  PlusIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

interface ChatSidebarProps {
  selectedRoomId?: number;
  onRoomSelect: (roomId: number) => void;
}

interface SearchResult {
  type: 'chat' | 'internal_friend' | 'external_friend' | 'channel';
  data: ChatRoomDTO | ParticipantDTO | User;
  id: number;
  name: string;
  avatar?: string;
  subtitle?: string;
}

export default function ChatSidebar({ selectedRoomId, onRoomSelect }: ChatSidebarProps) {
  const { user } = useAuth();
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
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadChatRooms();
  }, [user]);

  // Debouncing effect for search query
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debouncing
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 1000); // 300ms delay

    // Cleanup function
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

  const loadChatRooms = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      // Use getChatRoomsByUserId for CHATS filter
      const rooms = await ApiService.getChatRoomsByUserId(user.id);
      setChatRooms(rooms);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat rooms';
      setError(errorMessage);
      console.error('Failed to load chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRooms = () => {
    let filtered = chatRooms;

    // Apply chat type filter
    if (activeFilter !== 'ALL') {
      const roomType = activeFilter as keyof typeof EnumRoomType;
      filtered = filtered.filter(room => room.type === EnumRoomType[roomType]);
    }

    setFilteredRooms(filtered);
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
          // Search in existing chat rooms
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
          // Search in messages via API
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
            // Search external users when query starts with @
            const username = query.substring(1);
            if (username.trim()) {
              try {
                // Use getUserByUsername API for external search
                const externalUser = await ApiService.getUserByUsername(username);
                
                // Only add if it's not the current user
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
                // User not found - this is normal, don't show error to user
              }
            }
          } else {
            // Search internal friends using getPersonalChatPartners
            try {
              const personalPartners = await ApiService.getPersonalChatPartners(user.id);
              
              // Filter partners based on search query
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
                subtitle: `@${partner.username} • ${partner.online ? 'Online' : 'Offline'}`
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
        // Use createChatRoom API to find or create personal chat
        const personalChatRoom = await ApiService.createOrFindPersonalChat(result.id, user!.id);
        
        // Update local chat rooms if it's a new room
        const existingRoom = chatRooms.find(room => room.id === personalChatRoom.id);
        if (!existingRoom) {
          setChatRooms(prev => [personalChatRoom, ...prev]);
        }
        
        // Navigate to the chat
        handleRoomClick(personalChatRoom.id);
        
        // Clear search
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
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleCreateNewChat = (type: 'GROUP' | 'CHANNEL') => {
    setShowMenu(false);
    // TODO: Implement create chat modal
    console.log(`Create new ${type}`);
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

  if (error) {
    return (
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 text-center">
          <div className="text-red-500 text-sm mb-2">Error loading chats</div>
          <button 
            onClick={() => {
              setError(null);
              loadChatRooms();
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
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center"
                  >
                    <UserIcon className="w-4 h-4 mr-2" />
                    My Profile
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={() => handleCreateNewChat('GROUP')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center"
                  >
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    New Group
                  </button>
                  <button 
                    onClick={() => handleCreateNewChat('CHANNEL')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center"
                  >
                    <SpeakerWaveIcon className="w-4 h-4 mr-2" />
                    New Channel
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button 
                    onClick={handleSettings}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center"
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
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
            {displayItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
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
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`;
                      }}
                    />
                    {/* Show indicators based on type */}
                    {item.type === 'internal_friend' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                    {item.type === 'external_friend' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-blue-400 border-2 border-white rounded-full"></div>
                    )}
                    {item.type === 'chat' && (item.data as ChatRoomDTO).type === EnumRoomType.PERSONAL && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {item.name}
                      </h3>
                      {item.type === 'chat' && (item.data as ChatRoomDTO).lastMessageTimestamp && (
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatMessageTime((item.data as ChatRoomDTO).lastMessageTimestamp!)}
                        </span>
                      )}
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
      {error && (
        <div className="p-2 bg-red-50 border-t border-red-200">
          <div className="flex items-center justify-between">
            <span className="text-red-600 text-xs">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-800 hover:text-red-900"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}