import React, { useState, useEffect } from 'react';
import {
    Check, X, Search, Filter, RefreshCw, User, Shield,
    MoreVertical, AlertCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../../api';
import { useTheme } from '../../App';

export default function AdminUsers() {
    const { theme } = useTheme();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'active'
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchUsers();
    }, [filter, page, refreshKey]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (page !== 1) setPage(1);
            else fetchUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Create admin-specific API call method if not exists, or verify apiService has flexible get
            // Assuming apiService.get can be used directly or we added getUsers to apiService
            // Let's use apiService.get directly for custom admin route if needed, 
            // but apiService.getUsers is likely available or we can add it.
            // Based on previous file view, apiService.getUsers existed.

            const response = await apiService.get('/admin/users', {
                params: { status: filter === 'all' ? undefined : filter, search, page }
            });

            if (response.data?.success) {
                setUsers(response.data.data);
                setTotalPages(response.data.pagination?.pages || 1);
            }
        } catch (error) {
            console.error('Fetch users error:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId) => {
        if (!window.confirm('Approve this user? They will be able to log in.')) return;
        try {
            const response = await apiService.put(`/admin/users/${userId}/approve`, {});
            if (response.data?.success) {
                toast.success(response.data.message);
                setRefreshKey(prev => prev + 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Approval failed');
        }
    };

    const handleReject = async (userId) => {
        if (!window.confirm('Reject and delete this user request? This cannot be undone.')) return;
        try {
            const response = await apiService.put(`/admin/users/${userId}/reject`, {});
            if (response.data?.success) {
                toast.success(response.data.message);
                setRefreshKey(prev => prev + 1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Rejection failed');
        }
    };

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };

    return (
        <div className={`p-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">User Management</h1>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Manage system access and pending approvals
                    </p>
                </div>
                <button
                    onClick={() => setRefreshKey(k => k + 1)}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Filters & Search */}
            <div className={`mb-6 p-4 rounded-lg flex flex-col sm:flex-row gap-4 justify-between items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                } shadow-sm`}>
                <div className="flex gap-2">
                    {['pending', 'active', 'all'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f
                                    ? 'bg-blue-600 text-white'
                                    : theme === 'dark'
                                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className={`absolute left-3 top-2.5 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                            }`}
                    />
                </div>
            </div>

            {/* Users Table */}
            <div className={`rounded-lg overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                }`}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className={`text-xs uppercase font-medium ${theme === 'dark' ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                            }`}>
                            <tr>
                                <th className="px-6 py-3 text-left">User</th>
                                <th className="px-6 py-3 text-left">Role</th>
                                <th className="px-6 py-3 text-left">Status</th>
                                <th className="px-6 py-3 text-left">Joined</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                                            <span className="text-gray-500">Loading users...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No users found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg caplitalize ${theme === 'dark' ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {(user.full_name || user.username)[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{user.full_name || user.username}</p>
                                                    <p className="text-xs text-gray-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="capitalize">{user.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${user.signup_pending_approval
                                                    ? statusColors.pending
                                                    : user.is_active
                                                        ? statusColors.active
                                                        : statusColors.inactive
                                                }`}>
                                                {user.signup_pending_approval ? 'Pending Approval' : user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.signup_pending_approval ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(user.id)}
                                                        className="p-1.5 rounded-md text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                                                        title="Approve"
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(user.id)}
                                                        className="p-1.5 rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                                                        title="Reject"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination keys */}
                {/* Simplified pagination for now */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50"
                        >Previous</button>
                        <span className="px-3 py-1">Page {page} of {totalPages}</span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50"
                        >Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
