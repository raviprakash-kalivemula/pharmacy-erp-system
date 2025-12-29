/**
 * Socket.io Server Configuration
 * Handles real-time communication setup and event handlers
 */

const socketIO = require('socket.io');
const RealtimeService = require('../services/realtimeService');

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  const realtime = new RealtimeService(io);

  /**
   * Connection handler
   */
  io.on('connection', (socket) => {
    console.log('[Socket.io] New connection:', socket.id);

    /**
     * User joins
     * Expected: { userId, username }
     */
    socket.on('user:join', (data) => {
      const { userId, username } = data;
      if (!userId) {
        socket.emit('error', { message: 'userId required' });
        return;
      }

      realtime.registerUser(socket, userId, username);
      console.log(`[User] ${username} (ID: ${userId}) joined`);

      // Send active users to all
      io.emit('users:active', realtime.getActiveUsers());
    });

    /**
     * User changes page
     * Expected: { userId, page }
     */
    socket.on('user:pageChange', (data) => {
      const { userId, page } = data;
      if (userId) {
        realtime.updateUserPage(userId, page);
      }
    });

    /**
     * Inventory update
     * Expected: { medicineId, medicineData, userId }
     */
    socket.on('inventory:change', (data) => {
      const { medicineId, medicineData, userId } = data;
      if (medicineId && medicineData) {
        realtime.broadcastInventoryUpdate(medicineId, medicineData, userId);
      }
    });

    /**
     * Request edit lock
     * Expected: { documentId, userId, documentType }
     */
    socket.on('edit:lock', (data) => {
      const { documentId, userId, documentType } = data;
      const result = realtime.acquireEditLock(documentId, userId, documentType);
      socket.emit('edit:lockResult', result);
    });

    /**
     * Release edit lock
     * Expected: { documentId, userId }
     */
    socket.on('edit:unlock', (data) => {
      const { documentId, userId } = data;
      const result = realtime.releaseEditLock(documentId, userId);
      socket.emit('edit:unlockResult', result);
    });

    /**
     * Payment received event
     * Expected: { purchase }
     */
    socket.on('payment:received', (purchase) => {
      realtime.broadcastPaymentReceived(purchase);
    });

    /**
     * Sale completed event
     * Expected: { sale }
     */
    socket.on('sale:completed', (sale) => {
      realtime.broadcastSaleCompleted(sale);
    });

    /**
     * Get active sessions
     */
    socket.on('sessions:request', () => {
      socket.emit('sessions:data', {
        activeUsers: realtime.getActiveUsers(),
        editingSessions: realtime.getEditingSessions()
      });
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', () => {
      // Try to find userId from activeUsers
      let disconnectedUserId = null;
      realtime.activeUsers.forEach((user, userId) => {
        if (user.socketId === socket.id) {
          disconnectedUserId = userId;
        }
      });

      if (disconnectedUserId) {
        realtime.unregisterUser(disconnectedUserId);
        console.log(`[User] ID ${disconnectedUserId} disconnected`);
      }

      // Broadcast updated active users
      io.emit('users:active', realtime.getActiveUsers());
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      console.error('[Socket.io Error]', error);
    });
  });

  return { io, realtime };
}

module.exports = initializeSocket;
