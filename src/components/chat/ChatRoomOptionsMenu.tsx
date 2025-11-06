'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { ChatRoomDTO, ParticipantDTO, EnumRoomType, EnumRoomRole } from '@/types/chat';
import { User } from '@/types/user';
import {
  UserPlusIcon,
  PencilIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import PromoteAdminModal from './PromoteAdminModal';

interface ChatRoomOptionsMenuProps {
  chatRoom: ChatRoomDTO;
  isOpen: boolean;
  onClose: () => void;
  onRoomUpdated: (updatedRoom: ChatRoomDTO) => void;
  onRoomLeft: () => void;
}

interface SelectedUser {
  id: number;
  name: string;
  username: string;
  avatar?: string;
  type: 'internal' | 'external';
}

export default function ChatRoomOptionsMenu({ 
  chatRoom, 
  isOpen, 
  onClose, 
  onRoomUpdated, 
  onRoomLeft 
}: ChatRoomOptionsMenuProps) {
  const { user } = useAuth();
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserParticipant, setCurrentUserParticipant] = useState<ParticipantDTO | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [isLastAdmin, setIsLastAdmin] = useState(false);

  // Get current user's participant info
  useEffect(() => {
    if (user && chatRoom.participants) {
      const participant = chatRoom.participants.find(p => p.userId === user.id);
      setCurrentUserParticipant(participant || null);
    }
  }, [user, chatRoom.participants]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Debouncing for search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Search execution
  useEffect(() => {
    if (debouncedSearchQuery.trim() && showAddFriends) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, showAddFriends]);

  // Check if current user is the last admin
  useEffect(() => {
    if (currentUserParticipant && chatRoom.participants) {
      const adminCount = chatRoom.participants.filter(p => p.role === EnumRoomRole.ADMIN).length;
      const isCurrentUserAdmin = currentUserParticipant.role === EnumRoomRole.ADMIN;
      setIsLastAdmin(isCurrentUserAdmin && adminCount === 1);
    }
  }, [currentUserParticipant, chatRoom.participants]);

  // Handle searching users to add
  const handleSearch = async () => {
    if (!debouncedSearchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const query = debouncedSearchQuery.toLowerCase();
      const results: SelectedUser[] = [];

      // Get current participant IDs to exclude them
      const currentParticipantIds = chatRoom.participants?.map(p => p.userId) || [];

      if (query.startsWith('@')) {
        // Search external users
        const username = query.substring(1);
        if (username.trim()) {
          try {
            const externalUser = await ApiService.getUserByUsername(username);
            
            if (!currentParticipantIds.includes(externalUser.id) && 
                !selectedUsers.some(u => u.id === externalUser.id)) {
              results.push({
                id: externalUser.id,
                name: externalUser.fullName || externalUser.username,
                username: externalUser.username,
                avatar: externalUser.avatarUrl,
                type: 'external'
              });
            }
          } catch (error) {
            console.log('External user not found:', username);
          }
        }
      } else {
        // Search internal friends
        try {
          const personalPartners = await ApiService.getPersonalChatPartners(user.id);
          
          const filteredPartners = personalPartners.filter(partner => 
            (partner.fullName?.toLowerCase().includes(query) ||
             partner.username?.toLowerCase().includes(query)) &&
            !currentParticipantIds.includes(partner.userId) &&
            !selectedUsers.some(u => u.id === partner.userId)
          );
          
          results.push(...filteredPartners.map(partner => ({
            id: partner.userId,
            name: partner.fullName || partner.username,
            username: partner.username,
            avatar: undefined,
            type: 'internal' as const
          })));
        } catch (error) {
          console.error('Personal chat partners search error:', error);
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addUser = (userToAdd: SelectedUser) => {
    if (!selectedUsers.some(u => u.id === userToAdd.id)) {
      setSelectedUsers(prev => [...prev, userToAdd]);
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeUser = (userId: number) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleAddFriends = async () => {
    if (selectedUsers.length === 0 || !user) return;

    try {
      setLoading(true);
      setError(null);

      // Add each selected user
      for (const selectedUser of selectedUsers) {
        await ApiService.addParticipantToChatRoom(chatRoom.id, selectedUser.id, user.id);
      }

      // Refresh the chat room data
      const updatedRoom = await ApiService.getChatRoomById(chatRoom.id);
      onRoomUpdated(updatedRoom);

      // Reset state
      setSelectedUsers([]);
      setShowAddFriends(false);
      
    } catch (error) {
      console.error('Failed to add participants:', error);
      setError(error instanceof Error ? error.message : 'Failed to add participants');
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!newRoomName.trim() || !user) return;

    try {
      setLoading(true);
      setError(null);

      const updatedRoom = await ApiService.updateChatRoom(
        chatRoom.id,
        { name: newRoomName.trim() },
        user.id
      );

      onRoomUpdated(updatedRoom);
      setShowRename(false);
      setNewRoomName('');
      
    } catch (error) {
      console.error('Failed to rename room:', error);
      setError(error instanceof Error ? error.message : 'Failed to rename room');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;

    // Check if this is the last admin trying to leave
    if (isLastAdmin) {
        // Check if there are other members to promote
        const memberCount = chatRoom.participants?.filter(p => 
        p.userId !== user.id && p.role === EnumRoomRole.MEMBER
        ).length || 0;

        if (memberCount > 0) {
            // Show promote modal
            setShowPromoteModal(true);
            return;
        } else {
            // No members to promote, confirm deletion
            const confirmMessage = `You are the only participant in this ${
                chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'
            }. Leaving will delete the entire ${
                chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'
            }. Are you sure?`;
            
            if (!window.confirm(confirmMessage)) return;
        }
    } else {
        // Regular leave confirmation
        const confirmMessage = `Are you sure you want to leave this ${
        chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'
        }?`;

        if (!window.confirm(confirmMessage)) return;
    }

    // Proceed with leave operation
    await performLeave();
  };

  const performLeave = async () => {
    if (!user) return;

    try {
        setLoading(true);
        setError(null);

        // Promote Admin if only have 1 Admin
        // After that, Backend handle: remove participant or delete room if last user in room
        // Otherwise, just remove the participant if more members exist & not last admin
        await ApiService.deleteChatRoom(chatRoom.id, user.id, false);
        
        onRoomLeft();
        
    } catch (error) {
        console.error('Failed to leave room:', error);
        setError(error instanceof Error ? error.message : 'Failed to leave room');
    } finally {
        setLoading(false);
    }
    };

  const handleAdminPromoted = async () => {
    setShowPromoteModal(false);
    
    // Wait a moment for the promotion to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now proceed with leave operation
    await performLeave();
  };


  const canRename = currentUserParticipant?.role === EnumRoomRole.ADMIN;

  if (!isOpen || chatRoom.type === EnumRoomType.PERSONAL) return null;

  return (
    <div ref={menuRef} className="relative">
      <div className="absolute right-0 top-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
        
        {/* Main Menu */}
        {!showAddFriends && !showRename && (
          <div className="py-2">
            {/* Add Friends */}
            <button
              onClick={() => setShowAddFriends(true)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center text-black"
            >
              <UserPlusIcon className="w-4 h-4 mr-2" />
              Add Friends
            </button>

            {/* Rename (Admin only) */}
            {canRename && (
              <button
                onClick={() => {
                  setNewRoomName(chatRoom.name);
                  setShowRename(true);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm flex items-center text-black"
              >
                <PencilIcon className="w-4 h-4 mr-2" />
                Rename {chatRoom.type === EnumRoomType.GROUP ? 'Group' : 'Channel'}
              </button>
            )}

            <div className="border-t border-gray-100 my-1"></div>

            {/* Leave */}
            <button
              onClick={handleLeave}
              className="w-full px-4 py-2 text-left hover:bg-red-50 text-sm flex items-center text-red-600"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4 mr-2" />
              Leave {chatRoom.type === EnumRoomType.GROUP ? 'Group' : 'Channel'}
            </button>
          </div>
        )}

        {/* Add Friends Sub-menu */}
        {showAddFriends && (
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Add Friends</h3>
              <button
                onClick={() => {
                  setShowAddFriends(false);
                  setSelectedUsers([]);
                  setSearchQuery('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search friends or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-3 max-h-32 overflow-y-auto border border-gray-200 rounded">
                {searchResults.map((result) => (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => addUser(result)}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <img
                        src={result.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=random`}
                        alt={result.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-medium">{result.name}</div>
                        <div className="text-xs text-gray-500">@{result.username}</div>
                      </div>
                    </div>
                    <UserPlusIcon className="w-3 h-3 text-green-500" />
                  </div>
                ))}
              </div>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">Selected ({selectedUsers.length})</div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {selectedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between text-xs bg-blue-50 p-1 rounded">
                      <span>{user.name}</span>
                      <button onClick={() => removeUser(user.id)} className="text-red-500 hover:text-red-700">
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Button */}
            <button
              onClick={handleAddFriends}
              disabled={selectedUsers.length === 0 || loading}
              className="w-full py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Adding...' : `Add ${selectedUsers.length} Friend${selectedUsers.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Rename Sub-menu */}
        {showRename && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Rename {chatRoom.type === EnumRoomType.GROUP ? 'Group' : 'Channel'}</h3>
              <button
                onClick={() => {
                  setShowRename(false);
                  setNewRoomName('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              placeholder="Enter new name..."
              maxLength={50}
            />

            <button
              onClick={handleRename}
              disabled={!newRoomName.trim() || newRoomName.trim() === chatRoom.name || loading}
              className="w-full py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        )}

        {/* Add Promote Admin Modal */}
        <PromoteAdminModal
            isOpen={showPromoteModal}
            chatRoom={chatRoom}
            onClose={() => setShowPromoteModal(false)}
            onAdminPromoted={handleAdminPromoted}
        />

        {/* Error Message */}
        {error && (
          <div className="p-2 text-xs text-red-600 bg-red-50 border-t border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}