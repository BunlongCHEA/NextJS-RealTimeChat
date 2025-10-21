'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';

export default function ChatRoomPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const roomId = parseInt(params.roomId as string);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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
          selectedRoomId={roomId}
          onRoomSelect={(newRoomId) => {
            router.push(`/chat/${newRoomId}`);
            setShowSidebar(false);
          }}
        />
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex">
        <ChatWindow
          roomId={roomId}
          onBack={() => setShowSidebar(true)}
        />
      </div>
    </div>
  );
}