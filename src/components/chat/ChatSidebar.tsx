'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { ChatRoomDTO, ChatFilter, SearchFilter, EnumRoomType } from '@/types/chat';
// import { formatMessageTime, truncateMessage } from '@/lib/date-utils';
import { getChatRoomAvatar, getChatRoomDisplayName, formatMessageTime, truncateMessage, getMessagePreview } from '@/lib/chat-utils';
import { useChat } from '@/hooks/useChat';
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

export default function ChatSidebar({ selectedRoomId, onRoomSelect }: ChatSidebarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoomDTO[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoomDTO[]>([]);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('CHATS');
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChatRooms();
  }, [user]);

  useEffect(() => {
    filterRooms();
  }, [chatRooms, activeFilter, searchQuery, searchFilter]);

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

  const filterRooms = async () => {
    let filtered = chatRooms;

    // Apply chat type filter
    if (activeFilter !== 'ALL') {
      const roomType = activeFilter as keyof typeof EnumRoomType;
      filtered = filtered.filter(room => room.type === EnumRoomType[roomType]);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      try {
        switch (searchFilter) {
          case 'CHATS':
            filtered = filtered.filter(room => {
              const displayName = getChatRoomDisplayName(room, user!).toLowerCase();
              return displayName.includes(query) || room.name.toLowerCase().includes(query);
            });
            break;
            
          case 'MESSAGES':
            // Search in messages via API
            const searchResults = await ApiService.searchMessages(query);
            const roomIdsWithMessages = new Set(searchResults.map(msg => msg.chatRoomId));
            filtered = filtered.filter(room => roomIdsWithMessages.has(room.id));
            break;
            
          case 'CHANNELS':
            filtered = filtered.filter(room => 
              room.type === EnumRoomType.CHANNEL && 
              room.name.toLowerCase().includes(query)
            );
            break;
            
          case 'FRIENDS':
            filtered = filtered.filter(room => {
              if (room.type === EnumRoomType.PERSONAL && room.participants) {
                const otherParticipant = room.participants.find(p => p.userId !== user!.id);
                return otherParticipant?.fullName?.toLowerCase().includes(query) ||
                       otherParticipant?.username?.toLowerCase().includes(query);
              }
              return false;
            });
            break;
            
          default:
            filtered = filtered.filter(room => {
              const displayName = getChatRoomDisplayName(room, user!).toLowerCase();
              return displayName.includes(query);
            });
        }
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local search
        filtered = filtered.filter(room => {
          const displayName = getChatRoomDisplayName(room, user!).toLowerCase();
          return displayName.includes(query);
        });
      }
    }

    setFilteredRooms(filtered);
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

  if (error) {
    return (
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 text-center">
          <div className="text-red-500 text-sm mb-2">Error loading chats</div>
          <button 
            onClick={loadChatRooms}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
            onClick={() => setShowSearch(!showSearch)}
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
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <MagnifyingGlassIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="absolute right-2 top-2.5 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400" />
              </button>
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
          </div>
        )}

        {/* Chat Filter Buttons */}
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
      </div>

      {/* Chat Room List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading chats...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="mb-2">
              {searchQuery ? 'No chats found' : 'No chats available'}
            </div>
            {!searchQuery && (
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
            {filteredRooms.map((room) => {
              const displayName = getChatRoomDisplayName(room, user!);
              const avatarUrl = getChatRoomAvatar(room, user!);
              
              return (
                <div
                  key={room.id}
                  onClick={() => handleRoomClick(room.id)}
                  className={`p-3 hover:bg-gray-100 cursor-pointer border-l-4 transition-colors ${
                    selectedRoomId === room.id
                      ? 'bg-blue-50 border-blue-500'
                      : 'border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          // Fallback avatar
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
                        }}
                      />
                      {room.unreadCount && room.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </div>
                      )}
                      {/* Online status for personal chats */}
                      {room.type === EnumRoomType.PERSONAL && room.participants && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900 truncate text-sm">
                          {displayName}
                        </h3>
                        {room.lastMessageTimestamp && (
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {formatMessageTime(room.lastMessageTimestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 truncate">
                            {room.lastMessageContent && room.lastMessageType
                              ? truncateMessage(
                                  getMessagePreview(
                                    room.lastMessageContent, 
                                    room.lastMessageType, 
                                    room.lastMessageAttachmentCount
                                  ), 
                                  35
                                )
                              : 'No messages yet'
                            }
                          </p>
                        </div>
                        {/* Chat type icon */}
                        <div className="flex-shrink-0 ml-2">
                          {getChatTypeIcon(room.type)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}