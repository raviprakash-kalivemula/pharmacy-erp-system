// src/components/pages/Customers.jsx - UPDATED WITH PAGINATION & FILTERS
import React, { useState, useMemo } from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useModal from '../../hooks/useModal';
import useForm from '../../hooks/useForm';
import Button from '../common/Button';
import Modal from '../common/Modal';
import StatCard from '../common/StatCard';
import FormInput from '../common/FormInput';
import ConfirmDialog from '../common/ConfirmDialog';
import SkeletonLoader from '../common/SkeletonLoader';
import Pagination from '../common/Pagination';
import AdvancedFilters from '../common/AdvancedFilters';
import KeyboardShortcuts from '../common/KeyboardShortcuts';
import { Plus, Edit2, Trash2, Eye, Upload, FileText, Users, DollarSign, UserCheck, Phone, MapPin } from 'lucide-react';
import { formatCurrency, downloadCSV } from '../../utils/formatters';
import { validateCustomer } from '../../utils/validators';
import { safeNumber, calculateTotalOutstanding } from '../../utils/calculations';
import { DEFAULT_FORM_VALUES, CSV_TEMPLATES, MESSAGES } from '../../constants';
import toast from '../../utils/toast';

const Customers = () => {
  const { data: customersResponse, loading, refetch } = useFetch(api.getCustomers);
  const customers = customersResponse?.customers || [];
  
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
  const detailsModal = useModal();
  const importModal = useModal();
  const deleteConfirm = useModal();

  const { values: formData, errors: formErrors, handleChange, handleSubmit, resetForm, setValues } = useForm(
    DEFAULT_FORM_VALUES.customer,
    validateCustomer
  );

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    let result = [...(customers || [])];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower) ||
        c.address?.toLowerCase().includes(searchLower) ||
        c.gst_number?.toLowerCase().includes(searchLower) ||
        c.dl_number?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(c => {
        const outstanding = safeNumber(c.outstanding);
        if (filters.status === 'active') return outstanding === 0;
        if (filters.status === 'pending') return outstanding > 0;
        return true;
      });
    }

    return result;
  }, [customers, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Open Add Modal
  const handleAdd = () => {
    resetForm();
    addModal.openModal();
  };

  // Open Edit Modal
  const handleEdit = (customer) => {
    setValues({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      gst_number: customer.gst_number || '',
      dl_number: customer.dl_number || '',
      outstanding: safeNumber(customer.outstanding)
    });
    editModal.openModal(customer);
  };

  // Submit Form
  const onSubmit = async (values) => {
    try {
      if (editModal.isOpen) {
        await api.updateCustomer(values.id, values);
        toast.success(MESSAGES.SUCCESS.UPDATE);
      } else {
        await api.addCustomer(values);
        toast.success(MESSAGES.SUCCESS.SAVE);
      }
      refetch();
      addModal.closeModal();
      editModal.closeModal();
      resetForm();
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Delete Customer
  const handleDelete = async () => {
    try {
      await api.deleteCustomer(deleteConfirm.data.id);
      toast.success(MESSAGES.SUCCESS.DELETE);
      refetch();
      deleteConfirm.closeModal();
    } catch (error) {
      toast.error(MESSAGES.ERROR.DELETE);
    }
  };

  // Download Template
  const handleDownloadTemplate = () => {
    downloadCSV(CSV_TEMPLATES.CUSTOMER, 'customer_template.csv');
  };

  // Export to CSV
  const handleExport = () => {
    const csvData = filteredCustomers.map(c => ({
      Name: c.name,
      Phone: c.phone || '',
      Address: c.address || '',
      'GST Number': c.gst_number || '',
      'DL Number': c.dl_number || '',
      Outstanding: safeNumber(c.outstanding).toFixed(2)
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    downloadCSV(csv, `customers-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Customers exported successfully!');
  };

  // Calculate Stats
  const totalOutstanding = calculateTotalOutstanding(filteredCustomers);
  const activeCustomers = filteredCustomers.filter(c => safeNumber(c.outstanding) === 0).length;

  if (loading) return <SkeletonLoader type="table" rows={10} cols={6} />;

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
    detailsModal.closeModal();
  };

  return (
    <div className="space-y-6">
      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts 
        currentPage="customers" 
        onSave={handleSave}
        onAddNew={handleKeyboardAddNew}
        onClose={handleKeyboardClose}
      />

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Customer Management</h2>
        <div className="flex gap-2">
          <Button onClick={() => importModal.openModal()} variant="success" icon={Upload}>
            CSV Import
          </Button>
          <Button onClick={handleAdd} variant="primary" icon={Plus}>
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={customers?.length || 0} icon={Users} color="blue" />
        <StatCard title="Showing" value={filteredCustomers.length} icon={Users} color="purple" />
        <StatCard title="Total Outstanding" value={formatCurrency(totalOutstanding)} icon={DollarSign} color="red" />
        <StatCard title="Active Customers" value={activeCustomers} icon={UserCheck} color="green" />
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        onFilter={setFilters}
        onExport={handleExport}
        filters={filters}
        pageKey="customers"
        filterOptions={{
          searchPlaceholder: "Search by name, phone, GST/DL number, or address...",
          statusOptions: [
            { value: 'active', label: 'Active (No Outstanding)' },
            { value: 'pending', label: 'Pending (Has Outstanding)' }
          ]
        }}
      />

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Customer Name</th>
                <th className="px-4 py-3 text-left font-semibold">Contact</th>
                <th className="px-4 py-3 text-left font-semibold">GST / DL</th>
                <th className="px-4 py-3 text-left font-semibold">Outstanding</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    {filters.search || filters.status !== 'all' ? 'No customers found matching your filters' : 'No customers found'}
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(customer => {
                  const outstanding = safeNumber(customer.outstanding);
                  const isActive = outstanding === 0;
                  
                  return (
                    <tr key={customer.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{customer.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-sm">
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={14} className="text-gray-500" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.address && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin size={14} className="text-gray-500" />
                              <span className="truncate max-w-xs">{customer.address}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col text-xs">
                          {customer.gst_number && (
                            <div className="text-gray-700">
                              <span className="font-medium">GST:</span> {customer.gst_number}
                            </div>
                          )}
                          {customer.dl_number && (
                            <div className="text-gray-700">
                              <span className="font-medium">DL:</span> {customer.dl_number}
                            </div>
                          )}
                          {!customer.gst_number && !customer.dl_number && (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(outstanding)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {isActive ? 'active' : 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => detailsModal.openModal(customer)} className="text-blue-500 hover:text-blue-700" title="View Details">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => handleEdit(customer)} className="text-blue-500 hover:text-blue-700" title="Edit">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => deleteConfirm.openModal(customer)} className="text-red-500 hover:text-red-700" title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredCustomers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredCustomers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={addModal.isOpen || editModal.isOpen}
        onClose={() => {
          addModal.closeModal();
          editModal.closeModal();
          resetForm();
        }}
        title={editModal.isOpen ? 'Edit Customer' : 'Add New Customer'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormInput
            label="Customer Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={formErrors.name}
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Phone Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              error={formErrors.phone}
            />
            
            <FormInput
              label="GST Number"
              name="gst_number"
              value={formData.gst_number}
              onChange={handleChange}
              error={formErrors.gst_number}
            />
          </div>

          <FormInput
            label="Address"
            name="address"
            type="textarea"
            rows={2}
            value={formData.address}
            onChange={handleChange}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="DL Number"
              name="dl_number"
              value={formData.dl_number}
              onChange={handleChange}
            />
            
            {editModal.isOpen && (
              <FormInput
                label="Outstanding Amount"
                name="outstanding"
                type="number"
                step="0.01"
                value={formData.outstanding}
                onChange={handleChange}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" onClick={() => { addModal.closeModal(); editModal.closeModal(); resetForm(); }} variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editModal.isOpen ? 'Update Customer' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={importModal.isOpen}
        onClose={importModal.closeModal}
        title="CSV Import Customers"
        size="md"
      >
        <div className="space-y-4">
          <FormInput
            label="Upload CSV File"
            type="file"
            accept=".csv"
          />
          <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm">
            <FileText size={16} /> Download CSV Template
          </button>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={importModal.closeModal} variant="outline">Cancel</Button>
            <Button variant="success">Upload</Button>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={detailsModal.closeModal}
        title={`Customer Details - ${detailsModal.data?.name || ''}`}
        size="md"
      >
        {detailsModal.data && (
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Name</p>
              <p className="font-semibold">{detailsModal.data.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{detailsModal.data.phone || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-semibold">{detailsModal.data.address || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">GST Number</p>
              <p className="font-semibold">{detailsModal.data.gst_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">DL Number</p>
              <p className="font-semibold">{detailsModal.data.dl_number || 'N/A'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className={`font-bold text-lg ${safeNumber(detailsModal.data.outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(detailsModal.data.outstanding)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeModal}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleteConfirm.data?.name}?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default Customers;