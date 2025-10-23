'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { EnumRoomType, ParticipantDTO } from '@/types/chat';
import { User } from '@/types/user';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  UserMinusIcon,
  SpeakerWaveIcon,
  HashtagIcon
} from '@heroicons/react/24/outline';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChannelCreated: (channelId: number) => void;
}

interface SelectedSubscriber {
  id: number;
  name: string;
  username: string;
  avatar?: string;
  type: 'internal' | 'external';
}

export default function CreateChannelModal({ isOpen, onClose, onChannelCreated }: CreateChannelModalProps) {
  const { user } = useAuth();
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedSubscriber[]>([]);
  const [selectedSubscribers, setSelectedSubscribers] = useState<SelectedSubscriber[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (debouncedSearchQuery.trim()) {
      handleSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);

  // Reset modal state when opened/closed
  useEffect(() => {
    if (isOpen) {
      setChannelName('');
      setChannelDescription('');
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setSearchResults([]);
      setSelectedSubscribers([]);
      setError(null);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!debouncedSearchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const query = debouncedSearchQuery.toLowerCase();
      const results: SelectedSubscriber[] = [];

      if (query.startsWith('@')) {
        // Search external users when query starts with @
        const username = query.substring(1);
        if (username.trim()) {
          try {
            const externalUser = await ApiService.getUserByUsername(username);
            
            // Only add if it's not the current user and not already selected
            if (externalUser.id !== user.id && !selectedSubscribers.some(u => u.id === externalUser.id)) {
              results.push({
                id: externalUser.id,
                name: externalUser.fullName || externalUser.username,
                username: externalUser.username,
                avatar: externalUser.avatarUrl,
                type: 'external'
              });
            }
          } catch (error) {
            // User not found - this is normal for @ searches
            console.log('External user not found:', username);
          }
        }
      } else {
        // Search internal friends using getPersonalChatPartners
        try {
          const personalPartners = await ApiService.getPersonalChatPartners(user.id);
          
          const filteredPartners = personalPartners.filter(partner => 
            (partner.fullName?.toLowerCase().includes(query) ||
             partner.username?.toLowerCase().includes(query)) &&
            !selectedSubscribers.some(u => u.id === partner.userId)
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
      setSearchLoading(false);
    }
  };

  const addSubscriber = (subscriberToAdd: SelectedSubscriber) => {
    if (!selectedSubscribers.some(u => u.id === subscriberToAdd.id)) {
      setSelectedSubscribers(prev => [...prev, subscriberToAdd]);
      setSearchQuery('');
      setDebouncedSearchQuery('');
      setSearchResults([]);
    }
  };

  const removeSubscriber = (subscriberId: number) => {
    setSelectedSubscribers(prev => prev.filter(u => u.id !== subscriberId));
  };

  const createChannel = async () => {
    if (!channelName.trim()) {
      setError('Channel name is required');
      return;
    }

    // Channels can be created without initial subscribers (unlike groups)
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      // Prepare participants data (subscribers)
      const participants = selectedSubscribers.map(selectedSubscriber => ({
        userId: selectedSubscriber.id
      }));

      // Create channel chat room
      const channelData = {
        name: channelName.trim(),
        type: EnumRoomType.CHANNEL,
        participants: participants // Can be empty array for channels
      };

      const createdChannel = await ApiService.createChatRoom(channelData, user.id);
      
      console.log('Channel created successfully:', createdChannel);
      
      // Notify parent component
      onChannelCreated(createdChannel.id);
      
      // Close modal
      onClose();
      
    } catch (error) {
      console.error('Failed to create channel:', error);
      setError(error instanceof Error ? error.message : 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <SpeakerWaveIcon className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">Create Channel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Channel Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel Name *
            </label>
            <div className="relative">
              <HashtagIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Enter channel name..."
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={50}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {channelName.length}/50 characters
            </div>
          </div>

          {/* Channel Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              placeholder="What's this channel about?"
              value={channelDescription}
              onChange={(e) => setChannelDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              maxLength={200}
            />
            <div className="text-xs text-gray-500 mt-1">
              {channelDescription.length}/200 characters
            </div>
          </div>

          {/* Subscriber Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Subscribers (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search friends or @username for external users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              {searchLoading && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                </div>
              )}
            </div>

            {/* Search Hint */}
            <div className="text-xs text-gray-500 mt-1">
              {searchQuery.startsWith('@') ? 
                'Searching for specific username...' : 
                'Searching in your personal chat partners. Use @username to find external users.'
              }
            </div>
            <div className="text-xs text-blue-600 mt-1">
              💡 You can create the channel now and add subscribers later
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  onClick={() => addSubscriber(result)}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={result.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=random`}
                      alt={result.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">{result.name}</div>
                      <div className="text-xs text-gray-500">
                        @{result.username} • {result.type === 'internal' ? 'Friend' : 'External'}
                      </div>
                    </div>
                  </div>
                  <UserPlusIcon className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          )}

          {/* Selected Subscribers */}
          {selectedSubscribers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Subscribers ({selectedSubscribers.length})
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedSubscribers.map((selectedSubscriber) => (
                  <div
                    key={selectedSubscriber.id}
                    className="flex items-center justify-between p-2 bg-purple-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <img
                        src={selectedSubscriber.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedSubscriber.name)}&background=random`}
                        alt={selectedSubscriber.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{selectedSubscriber.name}</div>
                        <div className="text-xs text-gray-500">@{selectedSubscriber.username}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeSubscriber(selectedSubscriber.id)}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <UserMinusIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <SpeakerWaveIcon className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">About Channels</h4>
                <p className="text-xs text-blue-700">
                  Channels are perfect for broadcasting updates, announcements, or discussions to multiple subscribers. 
                  You can always add more subscribers later.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={createChannel}
            disabled={!channelName.trim() || creating}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <SpeakerWaveIcon className="w-4 h-4 mr-2" />
                Create Channel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}