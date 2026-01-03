import React, { useState, useCallback } from 'react';
import useFetch from '../../hooks/useFetch';
import useModal from '../../hooks/useModal';
import { formatDate, formatDateTime } from '../../utils/formatters';
import Modal from '../common/Modal';
import Table from '../common/Table';
import SkeletonLoader from '../common/SkeletonLoader';
import { AlertCircle, Eye, ChevronRight, Download } from 'lucide-react';
import toast from '../../utils/toast';

const AuditLog = ({ filters = {} }) => {
  const { isOpen, openModal, closeModal } = useModal();
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [exporting, setExporting] = useState(false);

  // Build query params from filters
  const queryParams = {
    limit,
    offset: (page - 1) * limit,
    ...filters,
  };

  const queryString = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const { data, loading, error } = useFetch(
    `/api/audit-logs?${queryString}`
  );

  const handleViewDetails = (log) => {
    setSelectedLog(log);
    openModal();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      // Build export query string
      const exportParams = Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      
      const response = await fetch(
        `/api/audit-logs/export/csv${exportParams ? '?' + exportParams : ''}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }
      
      // Get filename from response header
      const filename = response.headers
        .get('Content-Disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Audit logs exported successfully!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export audit logs: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (action) => {
    const badges = {
      CREATE: { bg: 'bg-green-100', text: 'text-green-800', label: 'Create' },
      UPDATE: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Update' },
      DELETE: { bg: 'bg-red-100', text: 'text-red-800', label: 'Delete' },
      LOGIN: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Login' },
      LOGOUT: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Logout' },
    };

    const badge = badges[action] || badges.CREATE;
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const renderNewValue = (value) => {
    if (!value) return 'N/A';
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    } catch {
      return value;
    }
  };

  const renderOldValue = (value) => {
    if (!value) return 'N/A';
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    } catch {
      return value;
    }
  };

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (row) => {
        const username = typeof row.user_id === 'object' ? row.user_id.username : 'Unknown';
        return <span className="font-medium">{username}</span>;
      },
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => getActionBadge(row.action),
    },
    {
      key: 'entity_type',
      label: 'Entity Type',
      render: (row) => (
        <span className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
          {row.entity_type}
        </span>
      ),
    },
    {
      key: 'entity_id',
      label: 'Entity ID',
      render: (row) => <span className="font-mono text-sm">{row.entity_id}</span>,
    },
    {
      key: 'created_at',
      label: 'Timestamp',
      render: (row) => (
        <div className="text-sm">
          <div>{formatDateTime(new Date(row.created_at))}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          <Eye size={16} />
          Details
        </button>
      ),
    },
  ];

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-red-900">Error Loading Audit Logs</h3>
          <p className="text-red-700 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
            <p className="text-sm text-gray-600 mt-1">
              View all system activities and changes
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || loading || !data?.logs?.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export to CSV'}
          </button>
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonLoader count={5} height="h-12" />
          </div>
        ) : data?.logs?.length > 0 ? (
          <>
            <Table columns={columns} data={data.logs} />
            <div className="p-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, data.total)} of {data.total} records
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {[...Array(Math.ceil(data.total / limit))].map((_, i) => {
                    const pageNum = i + 1;
                    // Show first 3 pages, last page, and current page
                    if (pageNum <= 3 || pageNum === Math.ceil(data.total / limit) || Math.abs(pageNum - page) <= 1) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-2 text-sm font-medium rounded ${
                            pageNum === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === 4 && i === 3) {
                      return <span key="dots" className="text-gray-400">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(data.total / limit), page + 1))}
                  disabled={page >= Math.ceil(data.total / limit)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>No audit logs found</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Audit Log Details">
        {selectedLog && (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700">User</label>
                <p className="text-gray-900">
                  {typeof selectedLog.user_id === 'object'
                    ? selectedLog.user_id.username
                    : selectedLog.user_id}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Action</label>
                <p>{getActionBadge(selectedLog.action)}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Entity Type</label>
                <p className="text-gray-900">{selectedLog.entity_type}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">Entity ID</label>
                <p className="font-mono text-sm text-gray-900">{selectedLog.entity_id}</p>
              </div>
            </div>

            {/* Timestamp & IP */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Timestamp</label>
                <p className="text-gray-900">
                  {formatDateTime(new Date(selectedLog.created_at))}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">IP Address</label>
                <p className="font-mono text-sm text-gray-900">{selectedLog.ip_address}</p>
              </div>
            </div>

            {/* Old Value (Before) */}
            {selectedLog.old_value && (
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Before Update
                </label>
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm font-mono">
                  <pre className="whitespace-pre-wrap break-words text-red-900">
                    {renderOldValue(selectedLog.old_value)}
                  </pre>
                </div>
              </div>
            )}

            {/* New Value (After) */}
            {selectedLog.new_value && (
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  After Update
                </label>
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm font-mono">
                  <pre className="whitespace-pre-wrap break-words text-green-900">
                    {renderNewValue(selectedLog.new_value)}
                  </pre>
                </div>
              </div>
            )}

            {/* User Agent */}
            <div className="pt-2 border-t border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                User Agent
              </label>
              <p className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-x-auto">
                {selectedLog.user_agent}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLog;
