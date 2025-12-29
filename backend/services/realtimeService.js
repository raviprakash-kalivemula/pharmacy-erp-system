/**
 * Real-Time Service - Socket.io Manager
 * Manages live inventory sync and real-time notifications
 * Features:
 * - Inventory updates broadcasting
 * - Low stock alerts
 * - Concurrent edit detection
 * - User activity tracking
 */

class RealtimeService {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map(); // userId -> { socketId, lastActive, currentPage }
    this.editingSessions = new Map(); // documentId -> { userId, socketId, startTime }
    this.lowStockItems = new Set(); // Track items already alerted
  }

  /**
   * Register user connection
   */
  registerUser(socket, userId, username) {
    this.activeUsers.set(userId, {
      socketId: socket.id,
      username,
      lastActive: Date.now(),
      currentPage: null,
      ip: socket.handshake.address
    });

    // Broadcast user joined
    this.io.emit('user:joined', {
      userId,
      username,
      timestamp: new Date()
    });
  }

  /**
   * Unregister user on disconnect
   */
  unregisterUser(userId) {
    const user = this.activeUsers.get(userId);
    if (user) {
      // Clear any editing sessions
      this.editingSessions.forEach((session, docId) => {
        if (session.userId === userId) {
          this.editingSessions.delete(docId);
          this.io.emit('edit:release', {
            documentId: docId,
            userId,
            timestamp: new Date()
          });
        }
      });

      this.activeUsers.delete(userId);

      // Broadcast user left
      this.io.emit('user:left', {
        userId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Update user's current page
   */
  updateUserPage(userId, page) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.currentPage = page;
      user.lastActive = Date.now();

      // Broadcast page change
      this.io.emit('user:pageChanged', {
        userId,
        page,
        timestamp: new Date()
      });
    }
  }

  /**
   * Broadcast inventory update
   */
  broadcastInventoryUpdate(medicineId, medicineData, changedBy) {
    this.io.emit('inventory:updated', {
      medicineId,
      data: medicineData,
      changedBy,
      timestamp: new Date(),
      changeType: 'quantity_update'
    });

    // Check for low stock
    this.checkLowStock(medicineId, medicineData);
  }

  /**
   * Check if item is low stock and alert
   */
  checkLowStock(medicineId, medicineData) {
    const { quantity, minimum_stock_level } = medicineData;

    // Only alert once per item until stock is replenished
    if (quantity <= minimum_stock_level && !this.lowStockItems.has(medicineId)) {
      this.lowStockItems.add(medicineId);

      this.io.emit('inventory:lowStock', {
        medicineId,
        name: medicineData.name,
        currentStock: quantity,
        minimumStock: minimum_stock_level,
        severity: quantity === 0 ? 'critical' : 'warning',
        timestamp: new Date()
      });
    } else if (quantity > minimum_stock_level && this.lowStockItems.has(medicineId)) {
      // Item restocked
      this.lowStockItems.delete(medicineId);
      this.io.emit('inventory:restocked', {
        medicineId,
        name: medicineData.name,
        currentStock: quantity,
        timestamp: new Date()
      });
    }
  }

  /**
   * Lock document for editing (prevent double-edits)
   */
  acquireEditLock(documentId, userId, documentType = 'purchase') {
    // Check if already locked by another user
    const existingLock = this.editingSessions.get(documentId);
    if (existingLock && existingLock.userId !== userId) {
      return {
        success: false,
        error: `Document locked by ${existingLock.userId}`,
        lockedBy: existingLock.userId
      };
    }

    const socket = Array.from(this.activeUsers.values()).find(u => u.socketId);
    if (!socket) return { success: false, error: 'User not connected' };

    this.editingSessions.set(documentId, {
      userId,
      documentType,
      startTime: Date.now(),
      socketId: socket.socketId
    });

    // Notify others
    this.io.emit('edit:locked', {
      documentId,
      userId,
      documentType,
      timestamp: new Date()
    });

    return { success: true, lockId: documentId };
  }

  /**
   * Release edit lock
   */
  releaseEditLock(documentId, userId) {
    const lock = this.editingSessions.get(documentId);
    if (lock && lock.userId === userId) {
      this.editingSessions.delete(documentId);

      // Notify others
      this.io.emit('edit:release', {
        documentId,
        userId,
        timestamp: new Date()
      });

      return { success: true };
    }

    return { success: false, error: 'Lock not owned by this user' };
  }

  /**
   * Broadcast payment received event
   */
  broadcastPaymentReceived(purchase) {
    this.io.emit('payment:received', {
      purchaseId: purchase.id,
      supplierId: purchase.supplier_id,
      amount: purchase.total_amount,
      paymentMethod: purchase.payment_method,
      remainingBalance: purchase.pending_amount,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast sale completed
   */
  broadcastSaleCompleted(sale) {
    this.io.emit('sale:completed', {
      saleId: sale.id,
      customerId: sale.customer_id,
      totalAmount: sale.total_amount,
      itemsCount: sale.items_count,
      paymentStatus: sale.payment_status,
      timestamp: new Date()
    });
  }

  /**
   * Get active users count
   */
  getActiveUsersCount() {
    return this.activeUsers.size;
  }

  /**
   * Get active users list
   */
  getActiveUsers() {
    return Array.from(this.activeUsers.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }

  /**
   * Get editing sessions
   */
  getEditingSessions() {
    return Array.from(this.editingSessions.entries()).map(([docId, data]) => ({
      documentId: docId,
      ...data
    }));
  }
}

module.exports = RealtimeService;
