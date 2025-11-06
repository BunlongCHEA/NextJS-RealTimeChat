'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';

// // Generate static params for pre-built routes
// export async function generateStaticParams() {
//   // Generate static pages for common room IDs (1-100)
//   // You can adjust this range based on your needs
//   const roomIds = Array.from({ length: 999999 }, (_, i) => i + 1);
  
//   return roomIds.map((id) => ({
//     roomId: id.toString(),
//   }));
// }

// Define the ref type for ChatSidebar
interface ChatSidebarRef {
  refreshChatRooms: () => void;
}

export default function ChatRoomPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = parseInt(params.roomId as string);
  const [showSidebar, setShowSidebar] = useState(false);
  // const sidebarRef = useRef<ChatSidebarRef>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // // Handle when a new room is created
  // const handleRoomCreated = (newRoomId: number) => {
  //   // Refresh sidebar to show the new room
  //   if (sidebarRef.current?.refreshChatRooms) {
  //     sidebarRef.current.refreshChatRooms();
  //   }
  //   // Navigate to the new room
  //   router.push(`/chat/${newRoomId}`);
  // };

  // // Handle when a message is sent
  // const handleMessageSent = () => {
  //   // Refresh sidebar to update last message and timestamp
  //   if (sidebarRef.current?.refreshChatRooms) {
  //     sidebarRef.current.refreshChatRooms();
  //   }
  // };

  // // Handle when sidebar needs refresh (from WebSocket events)
  // const handleSidebarRefresh = () => {
  //   if (sidebarRef.current?.refreshChatRooms) {
  //     sidebarRef.current.refreshChatRooms();
  //   }
  // };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !roomId) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:block`}>
        <ChatSidebar
          // ref={sidebarRef}
          selectedRoomId={roomId}
          onRoomSelect={(newRoomId) => {
            router.push(`/chat/${newRoomId}`);
            setShowSidebar(false);
          }}
          // onRoomCreated={handleRoomCreated} // Pass room creation handler
          // onRefreshNeeded={handleSidebarRefresh} // Pass refresh handler
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex">
        <ChatWindow
          roomId={roomId}
          onBack={() => router.push('/chat')}
          // onRoomCreated={handleRoomCreated}
          // onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}