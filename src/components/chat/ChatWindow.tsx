'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { ChatRoomDTO, ChatMessageDTO, EnumMessageType, EnumRoomType } from '@/types/chat';
import { getChatRoomAvatar, getChatRoomDisplayName, formatMessageTime, getOnlineStatus } from '@/lib/chat-utils';
import Image from 'next/image';
import { 
  PaperAirplaneIcon,
  PhotoIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  FaceSmileIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

interface ChatWindowProps {
  roomId: number;
  onBack?: () => void;
}

export default function ChatWindow({ roomId, onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const [chatRoom, setChatRoom] = useState<ChatRoomDTO | null>(null);
  const [messages, setMessages] = useState<ChatMessageDTO[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (roomId) {
      loadChatRoom();
      loadMessages();
    }
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [newMessage]);

  const loadChatRoom = async () => {
    try {
      setError(null);
      const room = await ApiService.getChatRoomById(roomId);
      setChatRoom(room);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load chat room';
      setError(errorMessage);
      console.error('Failed to load chat room:', error);
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
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !user) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setSending(true);
      const message = await ApiService.createTextMessage(roomId, user.id, messageContent);
      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent); // Restore message on error
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setSending(true);
      const message = await ApiService.createImageMessage(roomId, user.id, file);
      setMessages(prev => [...prev, message]);
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

  const renderMessage = (message: ChatMessageDTO) => {
    const isOwn = message.senderId === user?.id;
    const showSender = !isOwn && chatRoom?.type !== EnumRoomType.PERSONAL;

    return (
      <div
        key={message.id}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {/* Avatar for non-own messages in group/channel */}
        {!isOwn && chatRoom?.type !== EnumRoomType.PERSONAL && (
          <div className="flex-shrink-0 mr-3">
            <Image
              src={message.senderAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.senderFullName || message.senderUsername)}&background=random`}
              alt={message.senderFullName || message.senderUsername}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
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
          {/* Sender info for group chats */}
          {showSender && (
            <div className="text-xs font-medium mb-1 text-blue-600">
              {message.senderFullName || message.senderUsername}
            </div>
          )}

          {/* Message content */}
          {message.type === EnumMessageType.IMAGE && message.attachmentUrls?.length > 0 ? (
            <div>
              {message.attachmentUrls.map((url, index) => (
                <Image
                  key={index}
                  src={url}
                  alt="Shared image"
                  width={300}
                  height={200}
                  className="max-w-full rounded mb-2 cursor-pointer hover:opacity-90"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
              {message.content && (
                <div className="mt-2">{message.content}</div>
              )}
            </div>
          ) : message.type === EnumMessageType.FILE && message.attachmentUrls?.length > 0 ? (
            <div>
              {message.attachmentUrls.map((url, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <PaperClipIcon className="w-4 h-4" />
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-100 underline text-sm"
                  >
                    File {index + 1}
                  </a>
                </div>
              ))}
              {message.content && (
                <div className="mt-2">{message.content}</div>
              )}
            </div>
          ) : message.type === EnumMessageType.SYSTEM ? (
            <div className="text-center italic text-sm opacity-75">
              {message.content}
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}

          {/* Timestamp */}
          <div
            className={`text-xs mt-1 ${
              isOwn
                ? 'text-blue-200'
                : 'text-gray-500'
            }`}
          >
            {formatMessageTime(message.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  const getSubtitle = () => {
    if (!chatRoom) return '';
    
    if (chatRoom.type === EnumRoomType.PERSONAL && chatRoom.participants) {
      const otherParticipant = chatRoom.participants.find(p => p.userId !== user?.id);
      if (otherParticipant) {
        return getOnlineStatus(otherParticipant.online, otherParticipant.lastSeen);
      }
    }
    
    if (chatRoom.type === EnumRoomType.GROUP) {
      const memberCount = chatRoom.participants?.length || 0;
      return `${memberCount} members`;
    }
    
    if (chatRoom.type === EnumRoomType.CHANNEL) {
      const subscriberCount = chatRoom.participants?.length || 0;
      return `${subscriberCount} subscribers`;
    }
    
    return '';
  };

  if (error && !chatRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error loading chat</div>
          <div className="text-gray-500 text-sm mb-4">{error}</div>
          <button
            onClick={() => {
              loadChatRoom();
              loadMessages();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!chatRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-500">Loading chat...</div>
        </div>
      </div>
    );
  }

  const displayName = getChatRoomDisplayName(chatRoom, user!);
  const avatarUrl = getChatRoomAvatar(chatRoom, user!);

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg md:hidden transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
            )}
            
            {/* Avatar */}
            <Image
              src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
              alt={displayName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
              }}
            />

            {/* Chat Info */}
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 truncate">{displayName}</h2>
              <p className="text-sm text-gray-500 truncate">
                {getSubtitle()}
              </p>
            </div>
          </div>

          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <EllipsisVerticalIcon className="w-5 h-5 text-gray-600" />
          </button>
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
              <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto text-gray-300" />
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
        <div className="flex items-end space-x-3">
          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
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

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />
            
            {/* Emoji button */}
            <button
              className="absolute right-3 bottom-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => {
                // TODO: Implement emoji picker
                console.log('Open emoji picker');
              }}
            >
              <FaceSmileIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
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