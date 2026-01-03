/**
 * Phase 2B Debugger Component
 * Real-time event monitor and Socket.io status viewer
 * Usage: Import and add to a dev/debug page or Dashboard
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRealtime } from '../../hooks/useRealtime';

const Phase2BDebugger = () => {
  const { socket } = useRealtime();
  const [events, setEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [locks, setLocks] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const eventsRef = useRef([]);
  const maxEvents = 50;

  useEffect(() => {
    if (!socket) return;

    // Connection status
    const handleConnect = () => {
      setConnectionStatus('connected');
      logEvent('✅ Socket Connected', { socketId: socket.id });
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      logEvent('❌ Socket Disconnected', {});
    };

    // Inventory events
    const handleInventoryUpdate = (data) => {
      logEvent('📦 Inventory Updated', data);
    };

    const handleLowStock = (data) => {
      logEvent('⚠️ Low Stock Alert', data);
    };

    // Edit locking events
    const handleEditLocked = (data) => {
      logEvent('🔒 Edit Lock Acquired', data);
      setLocks(prev => [...prev, { ...data, timestamp: new Date() }]);
    };

    const handleEditRelease = (data) => {
      logEvent('🔓 Edit Lock Released', data);
      setLocks(prev => prev.filter(lock => lock.documentId !== data.documentId));
    };

    // Payment/Sale events
    const handlePaymentReceived = (data) => {
      logEvent('💰 Payment Received', data);
    };

    const handleSaleCompleted = (data) => {
      logEvent('✅ Sale Completed', data);
    };

    // User activity
    const handleUserJoined = (data) => {
      logEvent('👤 User Joined', data);
      setOnlineUsers(prev => [...prev, { ...data, timestamp: new Date() }]);
    };

    const handleUserLeft = (data) => {
      logEvent('👤 User Left', data);
      setOnlineUsers(prev => prev.filter(u => u.userId !== data.userId));
    };

    // Register listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('inventory:updated', handleInventoryUpdate);
    socket.on('inventory:lowStock', handleLowStock);
    socket.on('edit:locked', handleEditLocked);
    socket.on('edit:release', handleEditRelease);
    socket.on('payment:received', handlePaymentReceived);
    socket.on('sale:completed', handleSaleCompleted);
    socket.on('user:joined', handleUserJoined);
    socket.on('user:left', handleUserLeft);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('inventory:updated', handleInventoryUpdate);
      socket.off('inventory:lowStock', handleLowStock);
      socket.off('edit:locked', handleEditLocked);
      socket.off('edit:release', handleEditRelease);
      socket.off('payment:received', handlePaymentReceived);
      socket.off('sale:completed', handleSaleCompleted);
      socket.off('user:joined', handleUserJoined);
      socket.off('user:left', handleUserLeft);
    };
  }, [socket]);

  const logEvent = (message, data) => {
    const timestamp = new Date().toLocaleTimeString();
    const newEvent = { timestamp, message, data, id: Math.random() };
    eventsRef.current = [newEvent, ...eventsRef.current].slice(0, maxEvents);
    setEvents([...eventsRef.current]);
  };

  const clearEvents = () => {
    eventsRef.current = [];
    setEvents([]);
  };

  const handleTestInventoryUpdate = () => {
    if (socket) {
      socket.emit('inventory:change', {
        medicineId: 1,
        name: 'Test Medicine',
        quantity: 50,
        price: 150,
        userId: 'test-user'
      });
      logEvent('🧪 Test: Inventory Update Emitted', {});
    }
  };

  const handleTestEditLock = () => {
    if (socket) {
      socket.emit('edit:lock', {
        documentId: 'invoice-001',
        documentType: 'invoice',
        userId: 'test-user'
      });
      logEvent('🧪 Test: Edit Lock Emitted', {});
    }
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg border border-purple-600 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          🔧 Phase 2B Debugger
          <span className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
        </h2>
        <button
          onClick={clearEvents}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Clear Log
        </button>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-gray-400 text-xs">Connection</div>
          <div className="font-bold text-lg mt-1">
            {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          {socket?.id && <div className="text-gray-500 text-xs mt-1 truncate">ID: {socket.id.substring(0, 8)}</div>}
        </div>

        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-gray-400 text-xs">Active Locks</div>
          <div className="font-bold text-lg mt-1">{locks.length}</div>
          {locks.length > 0 && (
            <div className="text-gray-500 text-xs mt-1">
              {locks.map((lock, i) => (
                <div key={i} className="truncate">{lock.documentId}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-gray-400 text-xs">Online Users</div>
          <div className="font-bold text-lg mt-1">{onlineUsers.length}</div>
          {onlineUsers.length > 0 && (
            <div className="text-gray-500 text-xs mt-1">
              {onlineUsers.slice(0, 2).map((user, i) => (
                <div key={i} className="truncate">{user.userId || 'Anonymous'}</div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-3 rounded border border-gray-700">
          <div className="text-gray-400 text-xs">Total Events</div>
          <div className="font-bold text-lg mt-1">{events.length}</div>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleTestInventoryUpdate}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          disabled={!socket}
        >
          Test: Emit Inventory Update
        </button>
        <button
          onClick={handleTestEditLock}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          disabled={!socket}
        >
          Test: Emit Edit Lock
        </button>
      </div>

      {/* Event Log */}
      <div className="bg-gray-800 rounded border border-gray-700 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-2">
          <div className="text-xs text-gray-400 font-mono">Event Log (Last {events.length}/{maxEvents})</div>
        </div>

        <div className="divide-y divide-gray-700">
          {events.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm">Waiting for events...</div>
          ) : (
            events.map((event) => (
              <div key={event.id} className="p-3 text-sm hover:bg-gray-700 transition">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-mono text-gray-300">{event.message}</div>
                    {Object.keys(event.data).length > 0 && (
                      <div className="text-gray-500 text-xs mt-1 font-mono">
                        {JSON.stringify(event.data, null, 2)
                          .split('\n')
                          .slice(0, 3)
                          .join('\n')}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-600 text-xs whitespace-nowrap">{event.timestamp}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-700 text-xs text-gray-400">
        <div>✓ Real-time events will appear above when Socket.io connects</div>
        <div>✓ Use test buttons to emit sample events for verification</div>
        <div>✓ Open this in multiple browser windows to see broadcasts in action</div>
      </div>
    </div>
  );
};

export default Phase2BDebugger;
