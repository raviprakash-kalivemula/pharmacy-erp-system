// src/components/pages/Inventory.jsx - UPDATED WITH PAGINATION & FILTERS
import React, { useState, useMemo, useEffect } from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useModal from '../../hooks/useModal';
import useForm from '../../hooks/useForm';
import useRealtime from '../../hooks/useRealtime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import StatCard from '../common/StatCard';
import FormInput from '../common/FormInput';
import ConfirmDialog from '../common/ConfirmDialog';
import SkeletonLoader from '../common/SkeletonLoader';
import Pagination from '../common/Pagination';
import AdvancedFilters from '../common/AdvancedFilters';
import KeyboardShortcuts from '../common/KeyboardShortcuts';
import { Plus, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, downloadCSV } from '../../utils/formatters';
import { validateMedicine, validateBatch } from '../../utils/validators';
import { safeNumber, calculateStockValue } from '../../utils/calculations';
import { DEFAULT_FORM_VALUES, MESSAGES, STOCK_THRESHOLDS } from '../../constants';
import toastQueue from '../../utils/toastQueue';

const Inventory = () => {
  const { data: medicinesData, loading, refetch } = useFetch(api.getMedicines);
  const medicines = Array.isArray(medicinesData?.medicines) ? medicinesData.medicines : Array.isArray(medicinesData) ? medicinesData : [];
  
  // Real-time sync
  const user = JSON.parse(localStorage.getItem('user')) || { id: 'unknown', username: 'User' };
  const { broadcastInventoryChange, onInventoryUpdate, onLowStockAlert } = useRealtime(user?.id, user?.username);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    status: 'all',
    category: 'all'
  });

  const addModal = useModal();
  const editModal = useModal();
  const batchModal = useModal();
  const deleteConfirm = useModal();
  const deleteBatchConfirm = useModal();

  const [batches, setBatches] = useState([]);

  const { values: formData, errors: formErrors, handleChange, handleSubmit, resetForm, setValues } = useForm(
    DEFAULT_FORM_VALUES.medicine,
    validateMedicine
  );

  const { values: batchData, errors: batchErrors, handleChange: handleBatchChange, handleSubmit: handleBatchSubmit, resetForm: resetBatchForm, setValues: setBatchValues } = useForm(
    DEFAULT_FORM_VALUES.batch,
    validateBatch
  );

  // Listen to real-time inventory updates
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribeUpdate = onInventoryUpdate?.((data) => {
      toastQueue.info(`Stock updated by ${data.changedBy || 'another user'}`, { duration: 2000 });
      refetch();
    });

    const unsubscribeLowStock = onLowStockAlert?.((alert) => {
      const message = alert.severity === 'critical' 
        ? `CRITICAL: ${alert.name} is out of stock!`
        : `LOW STOCK: ${alert.name} (${alert.currentStock} remaining)`;
      toastQueue.error(message);
    });

    return () => {
      unsubscribeUpdate?.();
      unsubscribeLowStock?.();
    };
  }, [user?.id, onInventoryUpdate, onLowStockAlert, refetch]);

  // Filtered and paginated data
  const filteredMedicines = useMemo(() => {
    let result = [...medicines];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(m =>
        m.name?.toLowerCase().includes(searchLower) ||
        m.salt?.toLowerCase().includes(searchLower) ||
        m.manufacturer?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(m => {
        const stock = m.total_stock || 0;
        if (filters.status === 'low') return stock <= m.min_stock && stock > 0;
        if (filters.status === 'out') return stock === 0;
        if (filters.status === 'good') return stock > m.min_stock;
        return true;
      });
    }

    // Date filter (expiry)
    if (filters.dateFrom || filters.dateTo) {
      result = result.filter(m => {
        if (!m.nearest_expiry) return false;
        const expiryDate = new Date(m.nearest_expiry);
        if (filters.dateFrom && expiryDate < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && expiryDate > new Date(filters.dateTo)) return false;
        return true;
      });
    }

    return result;
  }, [medicines, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredMedicines.length / itemsPerPage);
  const paginatedMedicines = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMedicines.slice(start, start + itemsPerPage);
  }, [filteredMedicines, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Fetch batches for a medicine
  const fetchBatches = async (medicineId) => {
    try {
      const res = await api.getMedicineBatches(medicineId);
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error:', error);
      setBatches([]);
    }
  };

  // Open Add Modal
  const handleAdd = () => {
    resetForm();
    addModal.openModal();
  };

  // Open Edit Modal
  const handleEdit = (medicine) => {
    setValues({
      id: medicine.id,
      name: medicine.name,
      salt: medicine.salt || '',
      manufacturer: medicine.manufacturer || '',
      hsn_code: medicine.hsn_code || '',
      pack: medicine.pack || '',
      rack: medicine.rack || '',
      barcode: medicine.barcode || '',
      min_stock: medicine.min_stock || STOCK_THRESHOLDS.DEFAULT_MIN
    });
    editModal.openModal(medicine);
  };

  // Open Batch Modal
  const handleViewBatches = async (medicine) => {
    await fetchBatches(medicine.id);
    batchModal.openModal(medicine);
    resetBatchForm();
  };

  // Submit Medicine Form
  const onSubmitMedicine = async (values) => {
    try {
      if (editModal.isOpen) {
        await api.updateMedicine(values.id, values);
        toastQueue.success(MESSAGES.SUCCESS.UPDATE);
        // Broadcast to all users in real-time
        broadcastInventoryChange?.(values.id, values);
      } else {
        await api.addMedicine(values);
        toastQueue.success(MESSAGES.SUCCESS.SAVE);
      }
      refetch();
      addModal.closeModal();
      editModal.closeModal();
      resetForm();
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Submit Batch Form
  const onSubmitBatch = async (values) => {
    try {
      await api.post(`/medicines/${batchModal.data.id}/batch`, values);
      toastQueue.success(MESSAGES.SUCCESS.SAVE);
      await fetchBatches(batchModal.data.id);
      refetch();
      resetBatchForm();
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Delete Medicine
  const handleDelete = async () => {
    try {
      await api.deleteMedicine(deleteConfirm.data.id);
      toastQueue.success(MESSAGES.SUCCESS.DELETE);
      refetch();
      deleteConfirm.closeModal();
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.DELETE);
    }
  };

  // Delete Batch
  const handleDeleteBatch = async () => {
    try {
      await api.delete(`/medicines/${batchModal.data.id}/batch/${deleteBatchConfirm.data.id}`);
      toastQueue.success(MESSAGES.SUCCESS.DELETE);
      await fetchBatches(batchModal.data.id);
      refetch();
      deleteBatchConfirm.closeModal();
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.DELETE);
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csvData = filteredMedicines.map(m => ({
      Name: m.name,
      Salt: m.salt || '',
      Manufacturer: m.manufacturer || '',
      'Total Stock': m.total_stock || 0,
      'Min Stock': m.min_stock || 0,
      'Nearest Expiry': m.nearest_expiry ? formatDate(m.nearest_expiry) : '',
      'Selling Rate': m.lowest_selling_rate || '',
      MRP: m.lowest_mrp || ''
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    downloadCSV(csv, `inventory-${new Date().toISOString().split('T')[0]}.csv`);
    toastQueue.success('Inventory exported successfully!');
  };

  // Check if expiry is near
  const isExpiryNear = (expiryDate) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysToExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysToExpiry <= 90;
  };

  // Calculate Stats
  const stockValue = calculateStockValue(medicines);
  const lowStock = medicines.filter(m => (m.total_stock || 0) <= m.min_stock).length;

  if (loading) return <SkeletonLoader type="table" rows={10} cols={7} />;

  // Keyboard shortcuts handlers
  const handleSave = () => {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.click();
    }
  };

  const handleKeyboardAddNew = () => {
    handleAdd();
  };

  const handleKeyboardClose = () => {
    addModal.closeModal();
    editModal.closeModal();
    batchModal.closeModal();
  };

  return (
    <div className="space-y-6">
      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts 
        currentPage="inventory" 
        onSave={handleSave}
        onAddNew={handleKeyboardAddNew}
        onClose={handleKeyboardClose}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <Button onClick={handleAdd} variant="primary" icon={Plus}>
          Add Medicine
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={medicines.length} icon={Package} color="blue" />
        <StatCard title="Showing" value={filteredMedicines.length} icon={Package} color="purple" />
        <StatCard title="Stock Value" value={stockValue > 0 ? formatCurrency(Math.round(stockValue)) : 'N/A'} icon={Package} color="green" />
        <StatCard title="Low Stock" value={lowStock} icon={AlertTriangle} color="red" />
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        onFilter={setFilters}
        onExport={handleExport}
        filters={filters}
        pageKey="inventory"
        filterOptions={{
          searchPlaceholder: "Search medicines by name, salt, or manufacturer...",
          statusOptions: [
            { value: 'good', label: 'Good Stock' },
            { value: 'low', label: 'Low Stock' },
            { value: 'out', label: 'Out of Stock' }
          ]
        }}
      />

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Medicine</th>
                <th className="px-4 py-3 text-left font-semibold">Salt</th>
                <th className="px-4 py-3 text-left font-semibold">Stock</th>
                <th className="px-4 py-3 text-left font-semibold">Batch</th>
                <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                <th className="px-4 py-3 text-left font-semibold">Selling Price</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMedicines.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    {filters.search || filters.status !== 'all' ? 'No medicines found matching your filters' : 'No medicines in inventory. Add one to get started!'}
                  </td>
                </tr>
              ) : (
                paginatedMedicines.map(medicine => (
                  <tr 
                    key={medicine.id} 
                    className={`border-b hover:bg-gray-50 ${(medicine.total_stock || 0) <= medicine.min_stock ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{medicine.name}</p>
                        <p className="text-xs text-gray-500">{medicine.manufacturer}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{medicine.salt || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${(medicine.total_stock || 0) <= medicine.min_stock ? 'text-red-600' : 'text-green-600'}`}>
                        {medicine.total_stock || 0}
                      </span>
                      {(medicine.total_stock || 0) <= medicine.min_stock && (
                        <AlertTriangle size={14} className="inline ml-1 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => handleViewBatches(medicine)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                        title="View all batches"
                      >
                        <Package size={16} />
                        <span className="font-medium">{medicine.batch_count || 0}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {medicine.nearest_expiry ? (
                        <span className={isExpiryNear(medicine.nearest_expiry) ? 'text-red-600 font-medium' : ''}>
                          {formatDate(medicine.nearest_expiry)}
                          {isExpiryNear(medicine.nearest_expiry) && (
                            <AlertTriangle size={12} className="inline ml-1" />
                          )}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {medicine.lowest_selling_rate ? (
                        <div className="text-gray-700">
                          <span className="font-semibold">{formatCurrency(medicine.lowest_selling_rate)}</span>
                          {medicine.lowest_mrp && (
                            <span className="text-xs text-gray-500 block">MRP: {formatCurrency(medicine.lowest_mrp)}</span>
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleViewBatches(medicine)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          View
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(medicine)} className="text-blue-600 hover:text-blue-700" title="Edit medicine details">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteConfirm.openModal(medicine)} className="text-red-600 hover:text-red-700" title="Delete medicine">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredMedicines.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredMedicines.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}

      {/* Modals remain the same... */}
      {/* Add/Edit Medicine Modal */}
      <Modal
        isOpen={addModal.isOpen || editModal.isOpen}
        onClose={() => { addModal.closeModal(); editModal.closeModal(); resetForm(); }}
        title={editModal.isOpen ? 'Edit Medicine' : 'Add Medicine'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmitMedicine)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Medicine Name" name="name" value={formData.name} onChange={handleChange} error={formErrors.name} required />
            <FormInput label="Salt" name="salt" value={formData.salt} onChange={handleChange} />
            <FormInput label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} />
            <FormInput label="HSN Code" name="hsn_code" value={formData.hsn_code} onChange={handleChange} />
            <FormInput label="Pack Size" name="pack" value={formData.pack} onChange={handleChange} />
            <FormInput label="Min Stock" name="min_stock" type="number" value={formData.min_stock} onChange={handleChange} />
            <FormInput label="Rack Location" name="rack" value={formData.rack} onChange={handleChange} />
            <FormInput label="Barcode" name="barcode" value={formData.barcode} onChange={handleChange} />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" onClick={() => { addModal.closeModal(); editModal.closeModal(); resetForm(); }} variant="outline">Cancel</Button>
            <Button type="submit" variant="primary">{editModal.isOpen ? 'Update Medicine' : 'Add Medicine'}</Button>
          </div>
        </form>
      </Modal>

      {/* Batch Modal */}
      <Modal
        isOpen={batchModal.isOpen}
        onClose={() => { batchModal.closeModal(); resetBatchForm(); }}
        title={`Batches - ${batchModal.data?.name || ''}`}
        size="xl"
      >
        {batchModal.data && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{batchModal.data.manufacturer} | Total Stock: {batchModal.data.total_stock || 0}</p>
            
            {/* Add Batch Form */}
            <form onSubmit={handleBatchSubmit(onSubmitBatch)} className="p-4 bg-blue-50 rounded border border-blue-200">
              <h4 className="font-semibold mb-3 text-blue-900">Add New Batch</h4>
              <div className="grid grid-cols-5 gap-3">
                <FormInput label="Batch Number" name="batch" value={batchData.batch} onChange={handleBatchChange} error={batchErrors.batch} required />
                <FormInput label="Expiry Date" name="expiry" type="date" value={batchData.expiry} onChange={handleBatchChange} error={batchErrors.expiry} required />
                <FormInput label="Stock" name="stock" type="number" value={batchData.stock} onChange={handleBatchChange} error={batchErrors.stock} required />
                <FormInput label="Purchase Rate" name="purchase_rate" type="number" step="0.01" value={batchData.purchase_rate} onChange={handleBatchChange} error={batchErrors.purchase_rate} required />
                <FormInput label="MRP" name="mrp" type="number" step="0.01" value={batchData.mrp} onChange={handleBatchChange} error={batchErrors.mrp} required />
              </div>
              <Button type="submit" variant="primary" size="sm" icon={Plus} className="mt-3">Add Batch</Button>
            </form>

            {/* Batches Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Batch</th>
                    <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                    <th className="px-4 py-3 text-left font-semibold">Stock</th>
                    <th className="px-4 py-3 text-left font-semibold">Purchase Rate</th>
                    <th className="px-4 py-3 text-left font-semibold">Selling Price</th>
                    <th className="px-4 py-3 text-left font-semibold">MRP</th>
                    <th className="px-4 py-3 text-left font-semibold">Margin</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                        <Package size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No batches found. Add a batch above to track stock.</p>
                      </td>
                    </tr>
                  ) : (
                    batches.map(batch => {
                      const isExpiring = isExpiryNear(batch.expiry);
                      const isExpired = new Date(batch.expiry) < new Date();
                      return (
                        <tr key={batch.id} className={`border-b ${isExpired ? 'bg-red-50' : isExpiring ? 'bg-yellow-50' : ''}`}>
                          <td className="px-4 py-3 font-medium">{batch.batch}</td>
                          <td className="px-4 py-3">
                            <span className={isExpired ? 'text-red-600 font-bold' : isExpiring ? 'text-orange-600 font-medium' : ''}>
                              {formatDate(batch.expiry)}
                              {isExpired && <span className="ml-1 text-xs">(EXPIRED)</span>}
                              {!isExpired && isExpiring && <span className="ml-1 text-xs">(EXPIRING SOON)</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${batch.stock === 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {batch.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatCurrency(batch.purchase_rate || 0)}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-blue-700">{formatCurrency(batch.selling_rate || 0)}</span>
                          </td>
                          <td className="px-4 py-3">{formatCurrency(batch.mrp || 0)}</td>
                          <td className="px-4 py-3">
                            <span className="text-green-600 font-medium">{safeNumber(batch.margin).toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteBatchConfirm.openModal(batch)} className="text-red-600 hover:text-red-700" title="Delete batch">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Medicine Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeModal}
        onConfirm={handleDelete}
        title="Delete Medicine"
        message={`Delete ${deleteConfirm.data?.name} and all its batches?`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Batch Confirmation */}
      <ConfirmDialog
        isOpen={deleteBatchConfirm.isOpen}
        onClose={deleteBatchConfirm.closeModal}
        onConfirm={handleDeleteBatch}
        title="Delete Batch"
        message={`Delete batch ${deleteBatchConfirm.data?.batch}?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default Inventory;
