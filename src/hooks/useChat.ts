// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { ApiService } from '@/lib/api';
// import { ChatRoomDTO, ChatMessageDTO, EnumRoomType } from '@/types/chat';
// import { useAuth } from './useAuth';

// export function useChat() {
//   const { user } = useAuth();
//   const [chatRooms, setChatRooms] = useState<ChatRoomDTO[]>([]);
//   const [messages, setMessages] = useState<Record<number, ChatMessageDTO[]>>({});
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const loadChatRooms = useCallback(async () => {
//     if (!user) return;
    
//     try {
//       setLoading(true);
//       setError(null);
//       const rooms = await ApiService.getChatRoomsByUserId(user.id);
//       setChatRooms(rooms);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to load chat rooms');
//       console.error('Failed to load chat rooms:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [user]);

//   const loadMessages = useCallback(async (roomId: number) => {
//     try {
//       setError(null);
//       const roomMessages = await ApiService.getMessagesByChatRoomId(roomId);
//       setMessages(prev => ({
//         ...prev,
//         [roomId]: roomMessages
//       }));
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to load messages');
//       console.error('Failed to load messages:', err);
//     }
//   }, []);

//   const sendMessage = useCallback(async (roomId: number, content: string) => {
//     if (!user) throw new Error('User not authenticated');
    
//     try {
//       const message = await ApiService.createTextMessage(roomId, user.id, content);
//       setMessages(prev => ({
//         ...prev,
//         [roomId]: [...(prev[roomId] || []), message]
//       }));
      
//       // Update the last message in chat rooms
//       setChatRooms(prev => prev.map(room => 
//         room.id === roomId 
//           ? {
//               ...room,
//               lastMessageContent: message.content,
//               lastMessageSenderUsername: message.senderUsername,
//               lastMessageTimestamp: message.timestamp,
//               lastMessageType: message.type
//             }
//           : room
//       ));
      
//       return message;
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to send message');
//       throw err;
//     }
//   }, [user]);

//   const sendImageMessage = useCallback(async (roomId: number, imageFile: File) => {
//     if (!user) throw new Error('User not authenticated');
    
//     try {
//       const message = await ApiService.createImageMessage(roomId, user.id, imageFile);
//       setMessages(prev => ({
//         ...prev,
//         [roomId]: [...(prev[roomId] || []), message]
//       }));
      
//       // Update the last message in chat rooms
//       setChatRooms(prev => prev.map(room => 
//         room.id === roomId 
//           ? {
//               ...room,
//               lastMessageContent: '📷 Photo',
//               lastMessageSenderUsername: message.senderUsername,
//               lastMessageTimestamp: message.timestamp,
//               lastMessageType: message.type
//             }
//           : room
//       ));
      
//       return message;
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to send image');
//       throw err;
//     }
//   }, [user]);

//   const filterRooms = useCallback((rooms: ChatRoomDTO[], filter: string): ChatRoomDTO[] => {
//     if (filter === 'ALL') return rooms;
//     return rooms.filter(room => room.type === filter as EnumRoomType);
//   }, []);

//   useEffect(() => {
//     loadChatRooms();
//   }, [loadChatRooms]);

//   return {
//     chatRooms,
//     messages,
//     loading,
//     error,
//     loadChatRooms,
//     loadMessages,
//     sendMessage,
//     sendImageMessage,
//     filterRooms,
//     setError
//   };
// }