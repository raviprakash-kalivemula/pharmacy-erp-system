// src/components/pages/Purchase.jsx - REFACTORED
import React, { useState } from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useSearch from '../../hooks/useSearch';
import useModal from '../../hooks/useModal';
import useForm from '../../hooks/useForm';
import useRealtime from '../../hooks/useRealtime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import SearchBar from '../common/SearchBar';
import StatCard from '../common/StatCard';
import FormInput from '../common/FormInput';
import ConfirmDialog from '../common/ConfirmDialog';
import { Plus, Upload, Clipboard, Eye, Trash2, FileText, ShoppingBag, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCurrency, getTodayDate, downloadCSV } from '../../utils/formatters';
import { safeNumber, calculateSellingRate } from '../../utils/calculations';
import { CSV_TEMPLATES, MESSAGES } from '../../constants';
import toastQueue from '../../utils/toastQueue';

const Purchase = () => {
  const { data: purchases, loading, refetch } = useFetch(() => api.get('/purchases'));
  const { data: suppliers } = useFetch(() => api.get('/purchases/suppliers'));
  
  // Real-time payment broadcasting
  const user = JSON.parse(localStorage.getItem('user')) || { id: 'unknown', username: 'User' };
  useRealtime(user?.id, user?.username);
  
  const { searchTerm, setSearchTerm, filteredData, clearSearch } = useSearch(
    purchases || [],
    null,
    ['invoice_no', 'supplier_name', 'total_amount', 'purchase_date', 'status']
  );

  const csvModal = useModal();
  const csvPasteModal = useModal();
  const manualModal = useModal();
  const supplierModal = useModal();
  const detailsModal = useModal();
  const paymentModal = useModal();
  const deleteConfirm = useModal();

  const [currentItem, setCurrentItem] = useState({
    hsn_code: '', product_name: '', pack: '', mfg: '', batch: '', exp: '',
    qty: 0, free: 0, mrp: 0, rate: 0, margin: 0, amount: 0, gst_percent: 12, salt: ''
  });

  const [manualItems, setManualItems] = useState([]);

  const { values: csvForm, handleChange: handleCsvChange, resetForm: resetCsvForm, setValues: setCsvValues } = useForm({
    supplier_id: '',
    invoice_no: '',
    purchase_date: getTodayDate(),
    file: null
  });

  const { values: csvPasteForm, handleChange: handleCsvPasteChange, resetForm: resetCsvPasteForm } = useForm({
    supplier_id: '',
    invoice_no: '',
    purchase_date: getTodayDate(),
    csvText: ''
  });

  const { values: manualForm, handleChange: handleManualChange, resetForm: resetManualForm } = useForm({
    supplier_id: '',
    invoice_no: '',
    purchase_date: getTodayDate()
  });

  const { values: supplierForm, handleChange: handleSupplierChange, handleSubmit: handleSupplierSubmit, resetForm: resetSupplierForm } = useForm({
    name: '', address: '', phone: '', gst_number: '', dl_number: ''
  });

  const { values: paymentForm, handleChange: handlePaymentChange, resetForm: resetPaymentForm } = useForm({
    payment_amount: '',
    payment_mode: 'cash',
    payment_reference: '',
    notes: ''
  });

  // CSV Upload
  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvForm.file) {
      toastQueue.warning('Please select a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvForm.file);
    formData.append('supplier_id', csvForm.supplier_id);
    formData.append('invoice_no', csvForm.invoice_no);
    formData.append('purchase_date', csvForm.purchase_date);

    try {
      const res = await api.post('/purchases/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toastQueue.success(`${res.data.message}`);
      refetch();
      csvModal.closeModal();
      resetCsvForm();
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error('Error uploading CSV: ' + (error.response?.data?.error || error.message));
    }
  };

  // CSV Paste Submit
  const handleCsvPasteSubmit = async (e) => {
    e.preventDefault();
    
    if (!csvPasteForm.csvText.trim()) {
      toastQueue.warning('Please paste CSV data');
      return;
    }

    try {
      const res = await api.post('/purchases/import-csv-paste', csvPasteForm);
      toastQueue.success(`${res.data.message}`);
      refetch();
      csvPasteModal.closeModal();
      resetCsvPasteForm();
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error('Error processing CSV: ' + (error.response?.data?.error || error.message));
    }
  };

  // Add Manual Item
  const addManualItem = () => {
    if (!currentItem.product_name || !currentItem.batch) {
      toastQueue.warning('Product name and batch are required');
      return;
    }

    const qty = parseInt(currentItem.qty) || 0;
    const rate = parseFloat(currentItem.rate) || 0;
    const amount = qty * rate;
    const margin = parseFloat(currentItem.margin) || 0;

    setManualItems([...manualItems, { ...currentItem, amount, margin }]);
    setCurrentItem({
      hsn_code: '', product_name: '', pack: '', mfg: '', batch: '', exp: '',
      qty: 0, free: 0, mrp: 0, rate: 0, margin: 0, amount: 0, gst_percent: 12, salt: ''
    });
  };

  // Remove Manual Item
  const removeManualItem = (index) => {
    setManualItems(manualItems.filter((_, i) => i !== index));
  };

  // Submit Manual Purchase
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (manualItems.length === 0) {
      toastQueue.warning('Please add at least one item');
      return;
    }

    try {
      await api.post('/purchases/manual', {
        ...manualForm,
        items: manualItems
      });
      toastQueue.success(MESSAGES.SUCCESS.SAVE);
      refetch();
      manualModal.closeModal();
      resetManualForm();
      setManualItems([]);
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Submit Supplier
  const onSubmitSupplier = async (values) => {
    try {
      await api.post('/purchases/suppliers', values);
      toastQueue.success(MESSAGES.SUCCESS.SAVE);
      refetch();
      supplierModal.closeModal();
      resetSupplierForm();
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.SAVE);
    }
  };

  // View Purchase Details
  const viewPurchaseDetails = async (purchaseId) => {
    try {
      const res = await api.get(`/purchases/${purchaseId}`);
      detailsModal.openModal(res.data);
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.FETCH);
    }
  };

  // Update Status
  const updateStatus = async (id, status) => {
    try {
      await api.put(`/purchases/${id}`, { status });
      toastQueue.success(`Status updated to ${status}!`);
      refetch();
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Delete Purchase
  const handleDelete = async () => {
    try {
      await api.delete(`/purchases/${deleteConfirm.data.id}`);
      toastQueue.sucess(MESSAGES.SUCCESS.DELETE);
      refetch();
      deleteConfirm.closeModal();
    } catch (error) {
      toastQueue.error(MESSAGES.ERROR.DELETE);
    }
  };

  // Record Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      if (!paymentForm.payment_amount || paymentForm.payment_amount <= 0) {
        toastQueue.warning('Please enter a valid payment amount');
        return;
      }

      const purchaseId = paymentModal.data?.id;
      const amountDue = safeNumber(paymentModal.data?.amount_due);
      const paymentAmount = safeNumber(paymentForm.payment_amount);

      if (paymentAmount > amountDue) {
        toastQueue.warning(`Payment amount cannot exceed amount due (${formatCurrency(amountDue)})`);
        return;
      }

      const res = await api.post(`/purchases/${purchaseId}/payments`, {
        payment_amount: paymentAmount,
        payment_mode: paymentForm.payment_mode,
        payment_reference: paymentForm.payment_reference,
        notes: paymentForm.notes
      });

      toastQueue.success('Payment recorded successfully');
      refetch();
      paymentModal.closeModal();
      resetPaymentForm();
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error('Error recording payment: ' + (error.response?.data?.error || error.message));
    }
  };

  // Download Template
  const handleDownloadTemplate = () => {
    downloadCSV(CSV_TEMPLATES.PURCHASE, 'purchase_template.csv');
  };

  // Calculate Stats
  const displayPurchases = filteredData || [];
  const totalAmount = displayPurchases.reduce((sum, p) => sum + safeNumber(p.total_amount), 0);
  const pendingCount = displayPurchases.filter(p => p.status === 'pending').length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading...</div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Purchase Orders</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => supplierModal.openModal()} variant="primary" icon={Plus} size="sm">
            Add Supplier
          </Button>
          <Button onClick={() => csvPasteModal.openModal()} variant="warning" icon={Clipboard} size="sm">
            Paste CSV
          </Button>
          <Button onClick={() => csvModal.openModal()} variant="success" icon={Upload} size="sm">
            CSV File
          </Button>
          <Button onClick={() => manualModal.openModal()} variant="primary" icon={Plus} size="sm">
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Orders" value={displayPurchases.length} icon={ShoppingBag} color="blue" />
        <StatCard title="Total Amount" value={formatCurrency(totalAmount)} icon={DollarSign} color="green" />
        <StatCard title="Pending Orders" value={pendingCount} icon={AlertTriangle} color="orange" />
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow">
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={clearSearch}
          placeholder="Search by Invoice, Supplier, Amount, Date, or Status..."
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Invoice No</th>
                <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-right font-semibold">Due</th>
                <th className="px-4 py-3 text-center font-semibold">Payment Status</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayPurchases.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? 'No purchases found matching your search' : 'No purchases found'}
                  </td>
                </tr>
              ) : (
                displayPurchases.map(purchase => {
                  const paymentStatus = purchase.payment_status || 'pending';
                  const amountPaid = safeNumber(purchase.amount_paid);
                  const amountDue = safeNumber(purchase.amount_due);
                  const totalAmount = safeNumber(purchase.total_amount);
                  
                  return (
                    <tr key={purchase.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{purchase.invoice_no}</td>
                      <td className="px-4 py-3">{purchase.supplier_name || 'N/A'}</td>
                      <td className="px-4 py-3 font-semibold text-right text-green-600">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        {formatCurrency(amountPaid)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-orange-600">
                        {formatCurrency(amountDue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          paymentStatus === 'partial' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">{purchase.purchase_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          purchase.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          purchase.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {purchase.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => viewPurchaseDetails(purchase.id)} className="text-blue-500 hover:text-blue-700" title="View Details">
                            <Eye size={18} />
                          </button>
                          {paymentStatus !== 'paid' && (
                            <button onClick={() => paymentModal.openModal(purchase)} className="text-green-500 hover:text-green-700" title="Record Payment">
                              <DollarSign size={18} />
                            </button>
                          )}
                          {purchase.status === 'pending' && (
                            <button onClick={() => updateStatus(purchase.id, 'delivered')} className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">
                              Deliver
                            </button>
                          )}
                          <button onClick={() => deleteConfirm.openModal(purchase)} className="text-red-500 hover:text-red-700" title="Delete">
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

      {/* CSV Paste Modal */}
      <Modal
        isOpen={csvPasteModal.isOpen}
        onClose={() => { csvPasteModal.closeModal(); resetCsvPasteForm(); }}
        title="Paste CSV Data - Direct Import"
        size="xl"
      >
        <form onSubmit={handleCsvPasteSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <select name="supplier_id" value={csvPasteForm.supplier_id} onChange={handleCsvPasteChange} className="w-full p-2 border rounded" required>
                <option value="">Select Supplier</option>
                {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <FormInput label="Invoice Number" name="invoice_no" value={csvPasteForm.invoice_no} onChange={handleCsvPasteChange} required />
            <FormInput label="Purchase Date" name="purchase_date" type="date" value={csvPasteForm.purchase_date} onChange={handleCsvPasteChange} required />
          </div>

          <FormInput
            label="Paste CSV Data Here"
            name="csvText"
            type="textarea"
            rows={15}
            value={csvPasteForm.csvText}
            onChange={handleCsvPasteChange}
            placeholder="Paste your CSV data here... Example:\nHSN_CODE,PRODUCT_NAME,PACK,MFG,BATCH,EXP,QTY,FREE,M.R.P,RATE,AMOUNT,GST_%,MARGIN\n30049099,Paracetamol 500mg,10x10,Cipla,B1234,2026-03-15,100,0,129.00,40.00,4000.00,12,15"
            required
          />

          <div className="bg-blue-50 p-4 rounded border border-blue-200 text-sm space-y-2">
            <p className="font-semibold text-blue-900">📋 How to Use:</p>
            <ol className="list-decimal list-inside text-blue-800 space-y-1">
              <li>Copy CSV data from Excel (Ctrl+C)</li>
              <li>Paste directly above (Ctrl+V)</li>
              <li>Include header row</li>
              <li><strong className="text-green-600">MARGIN at END</strong> - Leave empty for existing medicines</li>
              <li>EXP date: YYYY-MM-DD format</li>
            </ol>
          </div>

          <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm">
            <FileText size={16} /> Download CSV Template
          </button>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" onClick={() => { csvPasteModal.closeModal(); resetCsvPasteForm(); }} variant="outline">Cancel</Button>
            <Button type="submit" variant="warning">Import CSV Data</Button>
          </div>
        </form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal
        isOpen={csvModal.isOpen}
        onClose={() => { csvModal.closeModal(); resetCsvForm(); }}
        title="CSV File Import"
        size="md"
      >
        <form onSubmit={handleCsvUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Supplier *</label>
            <select name="supplier_id" value={csvForm.supplier_id} onChange={handleCsvChange} className="w-full p-2 border rounded" required>
              <option value="">Select Supplier</option>
              {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <FormInput label="Invoice Number" name="invoice_no" value={csvForm.invoice_no} onChange={handleCsvChange} required />
          <FormInput label="Purchase Date" name="purchase_date" type="date" value={csvForm.purchase_date} onChange={handleCsvChange} required />
          <FormInput
            label="Upload CSV File"
            type="file"
            accept=".csv"
            onChange={(e) => setCsvValues({ ...csvForm, file: e.target.files[0] })}
            required
          />
          <button type="button" onClick={handleDownloadTemplate} className="flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm">
            <FileText size={16} /> Download CSV Template
          </button>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => { csvModal.closeModal(); resetCsvForm(); }} variant="outline">Cancel</Button>
            <Button type="submit" variant="success">Upload</Button>
          </div>
        </form>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={manualModal.isOpen}
        onClose={() => { manualModal.closeModal(); resetManualForm(); setManualItems([]); }}
        title="Manual Purchase Entry"
        size="xl"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Supplier *</label>
              <select name="supplier_id" value={manualForm.supplier_id} onChange={handleManualChange} className="w-full p-2 border rounded" required>
                <option value="">Select Supplier</option>
                {(suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <FormInput label="Invoice Number" name="invoice_no" value={manualForm.invoice_no} onChange={handleManualChange} required />
            <FormInput label="Purchase Date" name="purchase_date" type="date" value={manualForm.purchase_date} onChange={handleManualChange} required />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Add Items</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
              <input type="text" placeholder="HSN Code" className="p-2 border rounded text-sm" value={currentItem.hsn_code} onChange={(e) => setCurrentItem({...currentItem, hsn_code: e.target.value})} />
              <input type="text" placeholder="Product Name *" className="p-2 border rounded text-sm" value={currentItem.product_name} onChange={(e) => setCurrentItem({...currentItem, product_name: e.target.value})} />
              <input type="text" placeholder="Pack" className="p-2 border rounded text-sm" value={currentItem.pack} onChange={(e) => setCurrentItem({...currentItem, pack: e.target.value})} />
              <input type="text" placeholder="Manufacturer" className="p-2 border rounded text-sm" value={currentItem.mfg} onChange={(e) => setCurrentItem({...currentItem, mfg: e.target.value})} />
              <input type="text" placeholder="Batch *" className="p-2 border rounded text-sm" value={currentItem.batch} onChange={(e) => setCurrentItem({...currentItem, batch: e.target.value})} />
              <input type="date" placeholder="Expiry" className="p-2 border rounded text-sm" value={currentItem.exp} onChange={(e) => setCurrentItem({...currentItem, exp: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              <input type="number" placeholder="Qty *" className="p-2 border rounded text-sm" value={currentItem.qty} onChange={(e) => setCurrentItem({...currentItem, qty: e.target.value})} />
              <input type="number" placeholder="Free" className="p-2 border rounded text-sm" value={currentItem.free} onChange={(e) => setCurrentItem({...currentItem, free: e.target.value})} />
              <input type="number" step="0.01" placeholder="Rate *" className="p-2 border rounded text-sm" value={currentItem.rate} onChange={(e) => setCurrentItem({...currentItem, rate: e.target.value})} />
              <input type="number" step="0.01" placeholder="Margin %" className="p-2 border rounded text-sm bg-green-50" value={currentItem.margin} onChange={(e) => setCurrentItem({...currentItem, margin: e.target.value})} />
              <input type="number" step="0.01" placeholder="MRP" className="p-2 border rounded text-sm" value={currentItem.mrp} onChange={(e) => setCurrentItem({...currentItem, mrp: e.target.value})} />
              <input type="number" step="0.01" placeholder="GST %" className="p-2 border rounded text-sm" value={currentItem.gst_percent} onChange={(e) => setCurrentItem({...currentItem, gst_percent: e.target.value})} />
              <button type="button" onClick={addManualItem} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">
                <Plus size={16} className="inline" /> Add
              </button>
            </div>
            {currentItem.rate > 0 && currentItem.margin > 0 && (
              <p className="text-sm text-green-600 mt-2">
                💰 Selling Rate: {formatCurrency(calculateSellingRate(currentItem.rate, currentItem.margin))}
                <span className="text-gray-500 ml-2">({formatCurrency(currentItem.rate)} + {currentItem.margin}%)</span>
              </p>
            )}
          </div>

          {manualItems.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Items ({manualItems.length})</h4>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">Product</th>
                      <th className="px-2 py-2 text-left">Batch</th>
                      <th className="px-2 py-2 text-left">Qty</th>
                      <th className="px-2 py-2 text-left">Rate</th>
                      <th className="px-2 py-2 text-left">Margin</th>
                      <th className="px-2 py-2 text-left">Amount</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualItems.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-2 py-2">{item.product_name}</td>
                        <td className="px-2 py-2">{item.batch}</td>
                        <td className="px-2 py-2">{item.qty} + {item.free}</td>
                        <td className="px-2 py-2">{formatCurrency(item.rate)}</td>
                        <td className="px-2 py-2 text-green-600 font-medium">{item.margin}%</td>
                        <td className="px-2 py-2 font-semibold">{formatCurrency(item.amount)}</td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeManualItem(index)} className="text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-right font-bold">
                Total: {formatCurrency(manualItems.reduce((sum, item) => sum + safeNumber(item.amount), 0))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" onClick={() => { manualModal.closeModal(); resetManualForm(); setManualItems([]); }} variant="outline">Cancel</Button>
            <Button type="submit" disabled={manualItems.length === 0} variant="primary">Create Purchase Order</Button>
          </div>
        </form>
      </Modal>

      {/* Supplier Modal */}
      <Modal
        isOpen={supplierModal.isOpen}
        onClose={() => { supplierModal.closeModal(); resetSupplierForm(); }}
        title="Add Supplier"
        size="md"
      >
        <form onSubmit={handleSupplierSubmit(onSubmitSupplier)} className="space-y-4">
          <FormInput label="Supplier Name" name="name" value={supplierForm.name} onChange={handleSupplierChange} required />
          <FormInput label="Address" name="address" type="textarea" rows={2} value={supplierForm.address} onChange={handleSupplierChange} />
          <FormInput label="Phone Number" name="phone" type="tel" value={supplierForm.phone} onChange={handleSupplierChange} />
          <FormInput label="GST Number" name="gst_number" value={supplierForm.gst_number} onChange={handleSupplierChange} />
          <FormInput label="DL Number" name="dl_number" value={supplierForm.dl_number} onChange={handleSupplierChange} />
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => { supplierModal.closeModal(); resetSupplierForm(); }} variant="outline">Cancel</Button>
            <Button type="submit" variant="primary">Add Supplier</Button>
          </div>
        </form>
      </Modal>

      {/* Purchase Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={detailsModal.closeModal}
        title={`Purchase Order Details - ${detailsModal.data?.invoice_no || ''}`}
        size="xl"
      >
        {detailsModal.data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
              <div><strong>Supplier:</strong> {detailsModal.data.supplier_name}</div>
              <div><strong>Date:</strong> {detailsModal.data.purchase_date}</div>
              <div><strong>GST:</strong> {detailsModal.data.gst_number}</div>
              <div><strong>DL:</strong> {detailsModal.data.dl_number}</div>
            </div>

            {/* Payment Summary */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-lg mb-3">Payment Summary</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(safeNumber(detailsModal.data.total_amount))}
                  </div>
                  <div className="text-xs text-gray-600">Total Amount</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(safeNumber(detailsModal.data.amount_paid))}
                  </div>
                  <div className="text-xs text-gray-600">Amount Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(safeNumber(detailsModal.data.amount_due))}
                  </div>
                  <div className="text-xs text-gray-600">Amount Due</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    detailsModal.data.payment_status === 'paid' ? 'text-green-600' :
                    detailsModal.data.payment_status === 'partial' ? 'text-blue-600' :
                    'text-yellow-600'
                  }`}>
                    {Math.round((safeNumber(detailsModal.data.amount_paid) / safeNumber(detailsModal.data.total_amount)) * 100 || 0)}%
                  </div>
                  <div className="text-xs text-gray-600">Paid</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 text-lg">Items ({detailsModal.data.items?.length || 0})</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-3 text-left font-semibold">Product</th>
                      <th className="px-3 py-3 text-left font-semibold">Batch</th>
                      <th className="px-3 py-3 text-center font-semibold">Qty</th>
                      <th className="px-3 py-3 text-right font-semibold">Rate</th>
                      <th className="px-3 py-3 text-right font-semibold">Margin</th>
                      <th className="px-3 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsModal.data.items?.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-3 font-medium">{item.name}</td>
                        <td className="px-3 py-3">{item.batch}</td>
                        <td className="px-3 py-3 text-center font-semibold">{item.quantity}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(item.rate)}</td>
                        <td className="px-3 py-3 text-right text-green-600 font-semibold">{safeNumber(item.margin).toFixed(2)}%</td>
                        <td className="px-3 py-3 text-right font-bold text-blue-600">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            {detailsModal.data.payments && detailsModal.data.payments.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3 text-lg">Payment History</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">Date</th>
                        <th className="px-3 py-3 text-left font-semibold">Mode</th>
                        <th className="px-3 py-3 text-right font-semibold">Amount</th>
                        <th className="px-3 py-3 text-left font-semibold">Reference</th>
                        <th className="px-3 py-3 text-left font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsModal.data.payments.map((payment, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-3">{payment.payment_date}</td>
                          <td className="px-3 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">{payment.payment_mode}</span></td>
                          <td className="px-3 py-3 text-right font-bold text-green-600">{formatCurrency(payment.amount)}</td>
                          <td className="px-3 py-3">{payment.payment_reference || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-600">{payment.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="border-t pt-4 flex justify-between items-center bg-gray-50 p-4 rounded">
              <span className="text-lg font-semibold">Grand Total:</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(detailsModal.data.total_amount)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeModal}
        onConfirm={handleDelete}
        title="Delete Purchase"
        message={`Delete purchase order ${deleteConfirm.data?.invoice_no}? Stock will be adjusted.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Payment Recording Modal */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={() => { paymentModal.closeModal(); resetPaymentForm(); }}
        title={`Record Payment - ${paymentModal.data?.invoice_no || ''}`}
        size="md"
      >
        {paymentModal.data && (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600">Amount Due</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(safeNumber(paymentModal.data.amount_due))}
              </div>
            </div>

            <FormInput
              label="Payment Amount *"
              name="payment_amount"
              type="number"
              step="0.01"
              min="0.01"
              max={safeNumber(paymentModal.data.amount_due)}
              value={paymentForm.payment_amount}
              onChange={handlePaymentChange}
              required
            />

            <div>
              <label className="block text-sm font-medium mb-1">Payment Mode *</label>
              <select 
                name="payment_mode" 
                value={paymentForm.payment_mode} 
                onChange={handlePaymentChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            <FormInput
              label="Reference No"
              name="payment_reference"
              value={paymentForm.payment_reference}
              onChange={handlePaymentChange}
              placeholder="e.g., Cheque No, Transaction ID"
            />

            <FormInput
              label="Notes"
              name="notes"
              type="textarea"
              rows={3}
              value={paymentForm.notes}
              onChange={handlePaymentChange}
              placeholder="Additional payment notes..."
            />

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button 
                type="button" 
                onClick={() => { paymentModal.closeModal(); resetPaymentForm(); }} 
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">Record Payment</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Purchase;
