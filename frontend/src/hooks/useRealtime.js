/**
 * useRealtime Hook
 * Manages Socket.io connection and real-time event listeners
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const useRealtime = (userId, username) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [editingSessions, setEditingSessions] = useState([]);

  useEffect(() => {
    if (!userId) return;

    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,

    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('[Realtime] Connected:', socket.id);
      setIsConnected(true);

      // Register user
      socket.emit('user:join', { userId, username });
    });

    socket.on('disconnect', () => {
      console.log('[Realtime] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Realtime] Connection error:', error);
    });

    // Users activity
    socket.on('users:active', (users) => {
      setActiveUsers(users.filter(u => u.userId !== userId));
    });

    socket.on('user:joined', (data) => {
      console.log('[Realtime] User joined:', data.username);
    });

    socket.on('user:left', (data) => {
      console.log('[Realtime] User left:', data.userId);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [userId, username]);

  /**
   * Notify server of page change
   */
  const updatePage = useCallback((page) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('user:pageChange', { userId, page });
    }
  }, [userId]);

  /**
   * Broadcast inventory change
   */
  const broadcastInventoryChange = useCallback((medicineId, medicineData) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('inventory:change', {
        medicineId,
        medicineData,
        userId
      });
    }
  }, [userId]);

  /**
   * Listen to inventory updates
   */
  const onInventoryUpdate = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('inventory:updated', callback);
      return () => socketRef.current?.off('inventory:updated', callback);
    }
  }, []);

  /**
   * Listen to low stock alerts
   */
  const onLowStockAlert = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('inventory:lowStock', callback);
      return () => socketRef.current?.off('inventory:lowStock', callback);
    }
  }, []);

  /**
   * Request edit lock for document
   */
  const acquireEditLock = useCallback((documentId, documentType = 'purchase') => {
    return new Promise((resolve) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('edit:lock', { documentId, userId, documentType });
        socketRef.current.once('edit:lockResult', resolve);
      } else {
        resolve({ success: false, error: 'Not connected' });
      }
    });
  }, [userId]);

  /**
   * Release edit lock
   */
  const releaseEditLock = useCallback((documentId) => {
    return new Promise((resolve) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('edit:unlock', { documentId, userId });
        socketRef.current.once('edit:unlockResult', resolve);
      } else {
        resolve({ success: false, error: 'Not connected' });
      }
    });
  }, [userId]);

  /**
   * Listen to edit lock events
   */
  const onEditLocked = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('edit:locked', callback);
      return () => socketRef.current?.off('edit:locked', callback);
    }
  }, []);

  /**
   * Listen to edit release events
   */
  const onEditReleased = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('edit:release', callback);
      return () => socketRef.current?.off('edit:release', callback);
    }
  }, []);

  /**
   * Broadcast payment received
   */
  const broadcastPaymentReceived = useCallback((purchase) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('payment:received', purchase);
    }
  }, []);

  /**
   * Listen to payment received events
   */
  const onPaymentReceived = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('payment:received', callback);
      return () => socketRef.current?.off('payment:received', callback);
    }
  }, []);

  /**
   * Broadcast sale completed
   */
  const broadcastSaleCompleted = useCallback((sale) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('sale:completed', sale);
    }
  }, []);

  /**
   * Listen to sale completed events
   */
  const onSaleCompleted = useCallback((callback) => {
    if (socketRef.current) {
      socketRef.current.on('sale:completed', callback);
      return () => socketRef.current?.off('sale:completed', callback);
    }
  }, []);

  return {
    isConnected,
    activeUsers,
    editingSessions,
    updatePage,
    broadcastInventoryChange,
    onInventoryUpdate,
    onLowStockAlert,
    acquireEditLock,
    releaseEditLock,
    onEditLocked,
    onEditReleased,
    broadcastPaymentReceived,
    onPaymentReceived,
    broadcastSaleCompleted,
    onSaleCompleted,
    socket: socketRef.current
  };
};

export default useRealtime;
