import { ChatRoomDTO, EnumRoomType, EnumMessageType } from '@/types/chat';
import { User } from '@/types/user';

export function getChatRoomAvatar(room: ChatRoomDTO, currentUser: User): string | undefined {
  // For personal chats, use the other participant's avatar
  if (room.type === EnumRoomType.PERSONAL && room.participants) {
    const otherParticipant = room.participants.find(p => p.userId !== currentUser.id);
    return otherParticipant?.fullName ? 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(otherParticipant.fullName)}&background=random` : 
      undefined;
  }
  
  // For groups/channels, use a default group avatar or the room's avatar
  return room.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=random`;
}

export function getChatRoomDisplayName(room: ChatRoomDTO, currentUser: User): string {
  // For personal chats, use the other participant's name
  if (room.type === EnumRoomType.PERSONAL && room.participants) {
    const otherParticipant = room.participants.find(p => p.userId !== currentUser.id);
    return otherParticipant?.fullName || otherParticipant?.username || 'Unknown User';
  }
  
  // For groups/channels, use the room name
  return room.name;
}

export function formatMessageTime(dateString: string): string {
  const messageDate = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - messageDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    // Within a day - show HH:MM
    return messageDate.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  } else if (diffInDays < 7) {
    // Within a week - show day name
    return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    // Later than a week - show DD-MM-YYYY
    return messageDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}

export function truncateMessage(message: string, maxLength: number = 50): string {
  if (!message || message.length <= maxLength) return message || '';
  return message.substring(0, maxLength) + '...';
}

export function getMessagePreview(
  content: string, 
  type: EnumMessageType, 
  attachmentCount?: number
): string {
  switch (type) {
    case EnumMessageType.IMAGE:
      return attachmentCount && attachmentCount > 1 ? 
        `📷 ${attachmentCount} photos` : '📷 Photo';
    case EnumMessageType.FILE:
      return attachmentCount && attachmentCount > 1 ? 
        `📎 ${attachmentCount} files` : '📎 File';
    case EnumMessageType.SYSTEM:
      return content || 'System message';
    default:
      return content || '';
  }
}

export function isOnline(lastSeen?: string): boolean {
  if (!lastSeen) return false;
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
  return diffInMinutes < 5; // Consider online if seen within 5 minutes
}

export function getOnlineStatus(online: boolean, lastSeen?: string): string {
  if (online) return 'Online';
  if (!lastSeen) return 'Last seen long ago';
  
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInMs = now.getTime() - lastSeenDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInMinutes < 1) return 'Last seen just now';
  if (diffInMinutes < 60) return `Last seen ${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `Last seen ${diffInHours} hours ago`;
  if (diffInDays < 7) return `Last seen ${diffInDays} days ago`;
  
  return lastSeenDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Returns the UI color/status-dot class for sidebar/avatar indicator
export function getOnlineStatusUI(online: boolean, lastSeen?: string): string {
  if (online) return 'bg-green-500'; // online
  if (!lastSeen) return 'bg-gray-400';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffInMs = now.getTime() - lastSeenDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

  // If the user was recently seen (e.g., within 5 minutes), show a different color
  if (diffInMinutes < 5) return 'bg-yellow-400'; // recently online

  // Otherwise, offline/away
  return 'bg-gray-400';
}

// Unified export: returns both the text and UI class
export function userStatus(online: boolean, lastSeen?: string) {
  return {
    text: getOnlineStatus(online, lastSeen),
    dot: getOnlineStatusUI(online, lastSeen)
  };
}