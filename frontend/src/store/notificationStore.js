import { create } from 'zustand';
import { notificationApi } from '../utils/api';

const POLL_INTERVAL = 30000; // 30 seconds

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  hasMore: false,
  total: 0,
  pollIntervalId: null,

  // Fetch notifications (paginated)
  fetchNotifications: async (offset = 0, limit = 20) => {
    try {
      set({ isLoading: true });

      const response = await notificationApi.getNotifications({ offset, limit });

      if (response.success) {
        const { notifications, total, hasMore } = response.data;

        if (offset === 0) {
          // Fresh fetch
          set({
            notifications,
            total,
            hasMore,
            isLoading: false,
          });
        } else {
          // Append for pagination
          set((state) => ({
            notifications: [...state.notifications, ...notifications],
            total,
            hasMore,
            isLoading: false,
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },

  // Fetch unread count only (for polling)
  fetchUnreadCount: async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      if (response.success) {
        const newCount = response.data.count;
        const currentCount = get().unreadCount;

        // If count increased, optionally refresh notifications
        if (newCount > currentCount) {
          get().fetchNotifications(0, 20);
        }

        set({ unreadCount: newCount });
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  // Mark a single notification as read
  markAsRead: async (notificationId) => {
    try {
      const response = await notificationApi.markAsRead(notificationId);

      if (response.success) {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: 1 } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const response = await notificationApi.markAllAsRead();

      if (response.success) {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: 1 })),
          unreadCount: 0,
        }));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },

  // Delete a notification
  deleteNotification: async (notificationId) => {
    try {
      // Get the notification before deleting to check if unread
      const notification = get().notifications.find((n) => n.id === notificationId);

      const response = await notificationApi.deleteNotification(notificationId);

      if (response.success) {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          unreadCount:
            notification && !notification.is_read
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
          total: Math.max(0, state.total - 1),
        }));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  },

  // Add new notification (for real-time updates if implemented)
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
      total: state.total + 1,
    }));
  },

  // Start polling for new notifications
  startPolling: () => {
    const { pollIntervalId } = get();

    // Clear existing interval if any
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }

    // Initial fetch
    get().fetchUnreadCount();

    // Start polling
    const intervalId = setInterval(() => {
      get().fetchUnreadCount();
    }, POLL_INTERVAL);

    set({ pollIntervalId: intervalId });
  },

  // Stop polling
  stopPolling: () => {
    const { pollIntervalId } = get();
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      set({ pollIntervalId: null });
    }
  },

  // Reset store (on logout)
  reset: () => {
    const { pollIntervalId } = get();
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }

    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      hasMore: false,
      total: 0,
      pollIntervalId: null,
    });
  },
}));

export default useNotificationStore;
