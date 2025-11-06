'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';

// Define the ref type for ChatSidebar
interface ChatSidebarRef {
  refreshChatRooms: () => void;
}

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>();
  const [showSidebar, setShowSidebar] = useState(true);
  const sidebarRef = useRef<ChatSidebarRef>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // // Handle when a new room is created (from ChatWindow or ChatSidebar)
  // const handleRoomCreated = (roomId: number) => {
  //   // Refresh sidebar to show the new room
  //   if (sidebarRef.current?.refreshChatRooms) {
  //     sidebarRef.current.refreshChatRooms();
  //   }
  //   // Automatically select and navigate to the new room
  //   setSelectedRoomId(roomId);
  //   router.push(`/chat/${roomId}`);
  // };

  // // Handle when a message is sent (from ChatWindow)
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

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:block`}>
        <ChatSidebar
          // ref={sidebarRef}
          selectedRoomId={selectedRoomId}
          onRoomSelect={(roomId) => {
            setSelectedRoomId(roomId);
            router.push(`/chat/${roomId}`);
            setShowSidebar(false); // Hide sidebar on mobile after selection
          }}
          // onRoomCreated={handleRoomCreated} // Pass room creation handler
          // onRefreshNeeded={handleSidebarRefresh} // Pass refresh handler
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex">
        {selectedRoomId ? (
          <ChatWindow
            roomId={selectedRoomId}
            onBack={() => setShowSidebar(true)}
            // onRoomCreated={handleRoomCreated}
            // onMessageSent={handleMessageSent}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-600 mb-2">
                Welcome to Chat
              </h2>
              <p className="text-gray-500">
                Select a chat from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}