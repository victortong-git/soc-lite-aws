// Date and data formatting utilities

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

export const getSeverityColor = (severity?: number): string => {
  if (!severity) return 'gray';
  if (severity >= 4) return 'red';
  if (severity >= 3) return 'orange';
  if (severity >= 2) return 'yellow';
  return 'green';
};

export const getActionColor = (action: string): string => {
  switch (action.toUpperCase()) {
    case 'BLOCK':
      return 'red';
    case 'ALLOW':
      return 'green';
    case 'COUNT':
      return 'blue';
    default:
      return 'gray';
  }
};
