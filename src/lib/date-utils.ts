export function formatMessageTime(dateString: string): string {
  const messageDate = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - messageDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
//   const diffInWeeks = Math.floor(diffInDays / 7);

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
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
}