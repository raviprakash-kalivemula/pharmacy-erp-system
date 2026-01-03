import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Lock,
  LogOut,
  Shield,
  Database,
  FileText,
  Download,
  AlertCircle,
  CheckCircle,
  Users,
  RefreshCw,
  Store,
  Moon,
  Sun,
  Bell,
  Command,
  Check,
  X
} from 'lucide-react';
import api from '../../api';
import toast from '../../utils/toast';
import Button from '../common/Button';
import Modal from '../common/Modal';
import FormInput from '../common/FormInput';
import ConfirmDialog from '../common/ConfirmDialog';
import { useTheme } from '../../App';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [backupStats, setBackupStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [appSettings, setAppSettings] = useState({
    shop_name: '',
    address: '',
    phone: '',
    gst: '',
    license: '',
    currency_symbol: '$'
  });
  
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer'
  });
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');


  const user = JSON.parse(localStorage.getItem('user')) || {};

  // Load settings on component mount
  useEffect(() => {
    if (user?.role === 'admin') {
      loadUsers();
      loadBackups();
      loadAppSettings();
    }
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadNotifications = () => {
    const stored = localStorage.getItem('notification_history');
    if (stored) {
      const notifs = JSON.parse(stored);
      setNotifications(notifs);
      const unread = notifs.filter(n => !n.read).length;
      setUnreadCount(unread);
    }
  };

  const markNotificationAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('notification_history');
    toast.success('All notifications cleared');
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Bell className="w-4 h-4 text-blue-600" />;
    }
  };

  const loadAppSettings = async () => {
    try {
      console.log('⚙️ Loading app settings...');
      const response = await api.getSystemSettings();
      if (response.data?.data) {
        setAppSettings(prevSettings => ({
          ...prevSettings,
          ...response.data.data
        }));
        console.log('✅ App settings loaded successfully');
      }
    } catch (error) {
      console.error('❌ Failed to load app settings:', error);
      toast.error('Failed to load settings: ' + error.message);
    }
  };

  const handleSaveAppSettings = async (key, value) => {
    try {
      setLoading(true);
      await api.updateSystemSetting(key, value);
      toast.success(`${key.replace(/_/g, ' ')} updated successfully`);
      setAppSettings(prev => ({...prev, [key]: value}));
      setEditingField(null);
    } catch (error) {
      toast.error('Failed to update setting: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('👥 Loading users...');
      const response = await api.getUsers();
      if (response.data?.data) {
        setUsers(response.data.data);
        console.log('✅ Users loaded successfully:', response.data.data.length, 'users');
      }
    } catch (error) {
      console.error('❌ Failed to load users:', error);
      toast.error('Failed to load users: ' + error.message);
    }
  };

  const loadBackups = async () => {
    try {
      console.log('📦 Loading backups...');
      const response = await api.getBackups();
      if (response.data?.data) {
        setBackups(response.data.data);
        console.log('✅ Backups set:', response.data.data.length, 'items');
      }
      if (response.data?.stats) {
        setBackupStats(response.data.stats);
        console.log('✅ Backup stats set:', response.data.stats);
      }
    } catch (error) {
      console.error('❌ Failed to load backups:', error);
      toast.error('Failed to load backups: ' + error.message);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      await api.createBackup('Manual backup from admin panel');
      toast.success('Backup created successfully');
      loadBackups();
    } catch (error) {
      toast.error('Failed to create backup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      setLoading(true);
      await api.restoreBackup(selectedBackup.id, true);
      toast.success('Database restored successfully');
      setShowRestoreConfirm(false);
      loadBackups();
    } catch (error) {
      toast.error('Failed to restore backup: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (backup) => {
    try {
      await api.downloadBackup(backup.id);
    } catch (error) {
      toast.error('Failed to download backup: ' + error.message);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.username || !newUserForm.password) {
      toast.error('Username and password required');
      return;
    }

    try {
      setLoading(true);
      await api.createUser(newUserForm);
      toast.success('User created successfully');
      setNewUserForm({ username: '', email: '', password: '', role: 'viewer' });
      setShowNewUserModal(false);
      loadUsers();
    } catch (error) {
      toast.error('Failed to create user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      toast.success('User role updated');
      loadUsers();
    } catch (error) {
      toast.error('Failed to update user role: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.deleteUser(userId);
      toast.success('User deactivated');
      loadUsers();
    } catch (error) {
      toast.error('Failed to delete user: ' + error.message);
    }
  };

  const handleExport = async (type) => {
    try {
      const endpoints = {
        medicines: '/api/admin/export/medicines',
        medicinesExcel: '/api/admin/export/medicines-excel',
        customers: '/api/admin/export/customers',
        inventory: '/api/admin/export/inventory',
        auditLog: '/api/admin/audit-export'
      };

      window.location.href = endpoints[type];
    } catch (error) {
      toast.error('Export failed: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SettingsIcon className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            </div>
            <Button 
              onClick={async () => {
                try {
                  await api.logout();
                } catch (_) {}
                localStorage.removeItem('access_token');
                localStorage.removeItem('user');
                localStorage.removeItem('token_exp');
                window.location.href = '/';
              }}
              variant="secondary"
              icon={LogOut}
            >
              Logout
            </Button>
          </div>
          <p className="text-gray-600 mt-2">Manage your account, shop info, and system settings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto">
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Profile
                </div>
              </button>
              <button
                onClick={() => setActiveTab('shop')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'shop'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Shop Info
                </div>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  User Management
                </div>
              </button>
              <button
                onClick={() => setActiveTab('backup')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'backup'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Backup & Restore
                </div>
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'export'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Data
                </div>
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'notifications'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </div>
              </button>
              <button
                onClick={() => setActiveTab('theme')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'theme'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  Dark Mode
                </div>
              </button>
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === 'shortcuts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Command className="w-4 h-4" />
                  Keyboard Shortcuts
                </div>
              </button>
            </>
          )}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Information</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 font-medium">
                      {user?.username || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <div className="px-4 py-2 bg-blue-100 rounded-lg text-blue-900 font-medium capitalize">
                      {user?.role || 'N/A'}
                    </div>
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex gap-3">
                      <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-blue-900">Administrator</h3>
                        <p className="text-sm text-blue-700">You have full access to all system features and settings.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shop Info Tab */}
        {activeTab === 'shop' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop Information</h2>
              <div className="space-y-6">
                {/* Shop Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
                  {editingField === 'shop_name' ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <Button onClick={() => handleSaveAppSettings('shop_name', editingValue)} loading={loading} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('shop_name'); setEditingValue(appSettings.shop_name); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition">
                      {appSettings.shop_name || 'Click to edit'}
                    </div>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  {editingField === 'address' ? (
                    <div className="flex gap-2">
                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} rows="3" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <div className="flex flex-col gap-2">
                        <Button onClick={() => handleSaveAppSettings('address', editingValue)} loading={loading} size="sm">Save</Button>
                        <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('address'); setEditingValue(appSettings.address); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition whitespace-pre-wrap">
                      {appSettings.address || 'Click to edit'}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  {editingField === 'phone' ? (
                    <div className="flex gap-2">
                      <input type="tel" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <Button onClick={() => handleSaveAppSettings('phone', editingValue)} loading={loading} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('phone'); setEditingValue(appSettings.phone); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition">
                      {appSettings.phone || 'Click to edit'}
                    </div>
                  )}
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GST Number</label>
                  {editingField === 'gst' ? (
                    <div className="flex gap-2">
                      <input type="text" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} placeholder="Enter GST Number" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <Button onClick={() => handleSaveAppSettings('gst', editingValue)} loading={loading} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('gst'); setEditingValue(appSettings.gst); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition">
                      {appSettings.gst || 'Click to edit'}
                    </div>
                  )}
                </div>

                {/* Drug License */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Drug License Number</label>
                  {editingField === 'license' ? (
                    <div className="flex gap-2">
                      <input type="text" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} placeholder="Enter License Number" className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <Button onClick={() => handleSaveAppSettings('license', editingValue)} loading={loading} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('license'); setEditingValue(appSettings.license); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition">
                      {appSettings.license || 'Click to edit'}
                    </div>
                  )}
                </div>

                {/* Currency Symbol */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                  {editingField === 'currency_symbol' ? (
                    <div className="flex gap-2">
                      <select value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="$">$ (Dollar)</option>
                        <option value="€">€ (Euro)</option>
                        <option value="₹">₹ (Rupee)</option>
                        <option value="£">£ (Pound)</option>
                        <option value="¥">¥ (Yen)</option>
                      </select>
                      <Button onClick={() => handleSaveAppSettings('currency_symbol', editingValue)} loading={loading} size="sm">Save</Button>
                      <Button onClick={() => setEditingField(null)} variant="secondary" size="sm">Cancel</Button>
                    </div>
                  ) : (
                    <div onClick={() => { setEditingField('currency_symbol'); setEditingValue(appSettings.currency_symbol); }} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 cursor-pointer hover:bg-gray-200 transition">
                      {appSettings.currency_symbol} (Click to edit)
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-3">
                    <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900">Invoice Configuration</h3>
                      <p className="text-sm text-blue-700">These details will appear on all invoices and receipts.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                <Button onClick={() => setShowNewUserModal(true)} icon={Users}>Add New User</Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Username</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900 font-medium">{u.username}</td>
                        <td className="py-3 px-4 text-gray-600">{u.email || '-'}</td>
                        <td className="py-3 px-4">
                          <select value={u.role} onChange={(e) => handleChangeUserRole(u.id, e.target.value)} disabled={u.id === user?.id} className="px-3 py-1 border border-gray-300 rounded-lg text-sm capitalize">
                            <option value="admin">Admin</option>
                            <option value="pharmacist">Pharmacist</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                              <AlertCircle className="w-3 h-3" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {u.id !== user?.id && u.is_active && (
                            <button onClick={() => { if (window.confirm('Deactivate this user?')) { handleDeleteUser(u.id); } }} className="text-red-600 hover:text-red-900 text-sm font-medium">
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Restore Tab */}
        {activeTab === 'backup' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-gray-600 text-sm font-medium">Total Backups</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{backupStats?.totalBackups || 0}</div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-gray-600 text-sm font-medium">Total Size</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{backupStats?.totalSizeMB || '0'} MB</div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-gray-600 text-sm font-medium">Last Backup</div>
                <div className="text-sm text-gray-900 mt-2">{backupStats?.lastBackup ? new Date(backupStats.lastBackup).toLocaleDateString() : 'Never'}</div>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="text-gray-600 text-sm font-medium">Avg Size</div>
                <div className="text-3xl font-bold text-gray-900 mt-2">{backupStats?.avgSize || '0'} MB</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Backup</h2>
              <div className="flex gap-4 items-center">
                <p className="text-gray-600">Create a new database backup to protect your data.</p>
                <Button onClick={handleCreateBackup} loading={loading} icon={RefreshCw} className="flex-shrink-0">Create Backup Now</Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Backup History</h2>
              {backups.length === 0 ? (
                <div className="text-center py-8 text-gray-600">No backups yet. Create your first backup above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Filename</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Size</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Created</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map(backup => (
                        <tr key={backup.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-900 font-medium">{backup.filename}</td>
                          <td className="py-3 px-4 text-gray-600">{backup.sizeMB} MB</td>
                          <td className="py-3 px-4 text-gray-600">{new Date(backup.created_at).toLocaleString()}</td>
                          <td className="py-3 px-4 space-x-2">
                            <button onClick={() => handleDownloadBackup(backup)} className="text-blue-600 hover:text-blue-900 text-sm font-medium"><Download className="w-4 h-4 inline mr-1" />Download</button>
                            <button onClick={() => { setSelectedBackup(backup); setShowRestoreConfirm(true); }} className="text-green-600 hover:text-green-900 text-sm font-medium">Restore</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export Data Tab */}
        {activeTab === 'export' && user?.role === 'admin' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Export Data</h2>
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => handleExport('medicinesExcel')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                  <FileText className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">Export Medicines</h3>
                  <p className="text-sm text-gray-600 mt-1">Excel format</p>
                </button>
                <button onClick={() => handleExport('customers')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                  <FileText className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">Export Customers</h3>
                  <p className="text-sm text-gray-600 mt-1">CSV format</p>
                </button>
                <button onClick={() => handleExport('inventory')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                  <FileText className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">Export Inventory</h3>
                  <p className="text-sm text-gray-600 mt-1">Excel format</p>
                </button>
                <button onClick={() => handleExport('auditLog')} className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition">
                  <FileText className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">Export Audit Logs</h3>
                  <p className="text-sm text-gray-600 mt-1">CSV format</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
                  <p className="text-sm text-gray-600 mt-1">View and manage your notifications</p>
                </div>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 mx-auto mb-4 opacity-20 text-gray-400" />
                  <p className="text-gray-500 text-lg">No notifications yet</p>
                  <p className="text-gray-400 text-sm mt-2">When you get notifications, they'll show up here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-lg border-l-4 cursor-pointer transition ${
                        notif.read 
                          ? 'bg-gray-50 border-gray-300 hover:bg-gray-100' 
                          : 'bg-blue-50 border-blue-500 hover:bg-blue-100'
                      }`}
                      onClick={() => markNotificationAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{notif.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(notif.timestamp).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dark Mode Tab */}
        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Theme Preference</h2>
              <p className="text-gray-600 mb-6">Choose your preferred theme appearance</p>

              <div className="space-y-3">
                {/* Light Mode Option */}
                <button
                  onClick={() => {
                    if (theme !== 'light') toggleTheme();
                  }}
                  className={`w-full flex items-center gap-4 p-6 rounded-lg border-2 transition-all ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-lg ${theme === 'light' ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                    <Sun size={24} className={theme === 'light' ? 'text-yellow-600' : 'text-gray-600'} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">Light Mode</div>
                    <div className="text-sm text-gray-600">Bright and clear interface</div>
                  </div>
                  {theme === 'light' && (
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  )}
                </button>

                {/* Dark Mode Option */}
                <button
                  onClick={() => {
                    if (theme !== 'dark') toggleTheme();
                  }}
                  className={`w-full flex items-center gap-4 p-6 rounded-lg border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Moon size={24} className={theme === 'dark' ? 'text-blue-600' : 'text-gray-600'} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-900">Dark Mode</div>
                    <div className="text-sm text-gray-600">Easy on the eyes, perfect for night</div>
                  </div>
                  {theme === 'dark' && (
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  )}
                </button>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  💡 <strong>Tip:</strong> Your theme preference is saved automatically. It will be applied when you next visit the app.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Tab */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="flex items-center gap-2 mb-2">
                <Command className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-900">Keyboard Shortcuts</h2>
              </div>
              <p className="text-gray-600 mb-6">Use these keyboard shortcuts for faster navigation</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + N
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Create new customer
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + M
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Add new medicine
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + P
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    New purchase order
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + S
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Create new sale
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + D
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Go to dashboard
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + I
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Go to inventory
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + H
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Show shortcuts help
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + E
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Export data
                  </p>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <kbd className="px-3 py-1 bg-white border border-gray-300 rounded font-mono text-sm font-semibold text-gray-900 whitespace-nowrap flex-shrink-0">
                    Ctrl + R
                  </kbd>
                  <p className="text-sm text-gray-700 flex items-center pt-1">
                    Refresh page
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  💡 <strong>Tip:</strong> Shortcuts won't work while typing in input fields. Press Escape to close any open dialogs.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New User Modal */}
      <Modal isOpen={showNewUserModal} onClose={() => setShowNewUserModal(false)} title="Add New User">
        <div className="space-y-4">
          <FormInput label="Username" value={newUserForm.username} onChange={(e) => setNewUserForm({...newUserForm, username: e.target.value})} />
          <FormInput label="Email" type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})} />
          <FormInput label="Password" type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select value={newUserForm.role} onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="viewer">Viewer</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button onClick={() => setShowNewUserModal(false)} variant="secondary">Cancel</Button>
            <Button onClick={handleCreateUser} loading={loading}>Create User</Button>
          </div>
        </div>
      </Modal>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog isOpen={showRestoreConfirm} title="Restore Database?" message={`This will overwrite your current database with the backup from ${selectedBackup?.created_at ? new Date(selectedBackup.created_at).toLocaleString() : 'selected date'}. This action cannot be undone.`} confirmText="Restore" cancelText="Cancel" onConfirm={handleRestoreBackup} onCancel={() => setShowRestoreConfirm(false)} danger />
    </div>
  );
};

export default Settings;




