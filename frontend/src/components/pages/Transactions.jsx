// src/components/pages/Transactions.jsx - REFACTORED
import React from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useSearch from '../../hooks/useSearch';
import useModal from '../../hooks/useModal';
import useForm from '../../hooks/useForm';
import Button from '../common/Button';
import Modal from '../common/Modal';
import SearchBar from '../common/SearchBar';
import StatCard from '../common/StatCard';
import FormInput from '../common/FormInput';
import ConfirmDialog from '../common/ConfirmDialog';
import GSTInvoice from './GSTInvoice';
import { Eye, Printer, Trash2, Edit, Receipt, DollarSign, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { safeNumber } from '../../utils/calculations';
import { PAYMENT_MODES, MESSAGES } from '../../constants';
import toast from '../../utils/toast';

const Transactions = () => {
  const { data: transactionsResponse, loading, refetch } = useFetch(() => api.get('/sales'));
  const transactions = transactionsResponse?.transactions || [];
  const { searchTerm, setSearchTerm, filteredData, clearSearch } = useSearch(
    transactions || [],
    null,
    ['invoice_no', 'customer_name', 'total_amount', 'payment_status']
  );

  const detailsModal = useModal();
  const paymentModal = useModal();
  const invoiceModal = useModal();
  const deleteConfirm = useModal();

  const [invoiceData, setInvoiceData] = React.useState(null);

  const { values: paymentForm, handleChange, handleSubmit, resetForm, setValues } = useForm({
    amount_paid: '',
    payment_mode: 'cash'
  });

  // View Transaction Details
  const viewTransactionDetails = async (invoiceNo) => {
    try {
      const response = await api.get(`/sales/${invoiceNo}`);
      detailsModal.openModal(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.FETCH);
    }
  };

  // Open Payment Modal
  const openPaymentModal = async (transaction) => {
    try {
      const response = await api.get(`/sales/${transaction.invoice_no}`);
      setValues({
        amount_paid: '',
        payment_mode: response.data.payment_mode || 'cash'
      });
      paymentModal.openModal(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.FETCH);
    }
  };

  // Submit Payment Update
  const onSubmitPayment = async (values) => {
    const amount = parseFloat(values.amount_paid);
    const dueAmount = parseFloat(paymentModal.data.amount_due);

    if (!amount || amount <= 0) {
      toast.warning('Please enter a valid payment amount');
      return;
    }

    if (amount > dueAmount) {
      toast.warning('Payment amount cannot exceed due amount');
      return;
    }

    try {
      await api.put(`/sales/${paymentModal.data.invoice_no}/payment`, {
        amount_paid: amount,
        payment_mode: values.payment_mode
      });
      toast.success(MESSAGES.SUCCESS.UPDATE);
      paymentModal.closeModal();
      refetch();
      resetForm();
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.SAVE);
    }
  };

  // Open Invoice Modal
  const openInvoiceModal = async (transaction) => {
    try {
      const response = await api.get(`/sales/${transaction.invoice_no}`);
      const fullTransaction = response.data;
      
      const settingsRes = await api.get('/settings');
      const shopData = settingsRes.data;

      const formattedInvoiceData = {
        invoice_no: fullTransaction.invoice_no,
        sale_date: fullTransaction.created_at,
        customer: {
          name: fullTransaction.customer_name || 'Walk-in Customer',
          phone: fullTransaction.customer_phone || 'N/A',
          address: fullTransaction.customer_address || 'N/A',
          gst_number: fullTransaction.customer_gst || 'N/A',
          dl_number: fullTransaction.customer_dl || 'N/A'
        },
        items: fullTransaction.items?.map(item => ({
          name: item.medicine_name,
          manufacturer: item.manufacturer || 'N/A',
          pack: item.pack || 'N/A',
          hsn_code: item.hsn_code || 'N/A',
          batch: item.batch || 'N/A',
          expiry: item.expiry,
          quantity: item.quantity,
          free_quantity: item.free_quantity || 0,
          price: item.rate,
          total: item.amount,
          gst_percent: item.gst_percent || 12
        })) || [],
        subtotal: fullTransaction.subtotal || fullTransaction.total_amount,
        discount: fullTransaction.discount || 0,
        discountType: fullTransaction.discount_type || 'percentage',
        tax: fullTransaction.tax_amount || 0,
        grand_total: fullTransaction.total_amount,
        payment_mode: fullTransaction.payment_mode,
        payment_status: fullTransaction.payment_status,
        amount_paid: fullTransaction.amount_paid,
        amount_due: fullTransaction.amount_due,
        shop: shopData
      };

      setInvoiceData(formattedInvoiceData);
      invoiceModal.openModal(formattedInvoiceData);
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.FETCH);
    }
  };

  // Delete Transaction
  const handleDelete = async () => {
    try {
      await api.delete(`/sales/${deleteConfirm.data.invoice_no}`);
      toast.success(MESSAGES.SUCCESS.DELETE);
      refetch();
      deleteConfirm.closeModal();
    } catch (error) {
      console.error('Error:', error);
      toast.error(MESSAGES.ERROR.DELETE);
    }
  };

  // Calculate Stats
  const displayTransactions = filteredData || [];
  const totalRevenue = displayTransactions.reduce((sum, t) => sum + safeNumber(t.total_amount), 0);
  const pendingAmount = displayTransactions
    .filter(t => t.payment_status !== 'paid')
    .reduce((sum, t) => sum + safeNumber(t.amount_due), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading...</div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-2xl font-bold">Transaction History</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Transactions"
          value={displayTransactions.length}
          icon={Receipt}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Pending Payments"
          value={formatCurrency(pendingAmount)}
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow">
        <SearchBar
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={clearSearch}
          placeholder="Search by Invoice No, Customer, Amount, Date, or Status..."
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Invoice No</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                    {searchTerm ? 'No transactions found matching your search' : 'No transactions found'}
                  </td>
                </tr>
              ) : (
                displayTransactions.map(txn => (
                  <tr key={txn.invoice_no} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{txn.invoice_no}</td>
                    <td className="px-4 py-3">{txn.customer_name || 'Walk-in'}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">
                      {formatCurrency(txn.amount_paid)}
                    </td>
                    <td className="px-4 py-3">{formatDate(txn.created_at)}</td>
                    <td className="px-4 py-3">
                      {txn.payment_status === 'paid' ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                          Paid
                        </span>
                      ) : (
                        <span className="font-semibold text-red-600">
                          {formatCurrency(txn.amount_due)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => viewTransactionDetails(txn.invoice_no)} className="text-blue-500 hover:text-blue-700" title="View Details">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => openInvoiceModal(txn)} className="text-green-500 hover:text-green-700" title="Print Invoice">
                          <Printer size={18} />
                        </button>
                        {txn.payment_status !== 'paid' && (
                          <button onClick={() => openPaymentModal(txn)} className="text-orange-500 hover:text-orange-700" title="Edit Payment">
                            <Edit size={18} />
                          </button>
                        )}
                        <button onClick={() => deleteConfirm.openModal(txn)} className="text-red-500 hover:text-red-700" title="Delete">
                          <Trash2 size={18} />
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

      {/* Payment Update Modal */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={() => { paymentModal.closeModal(); resetForm(); }}
        title={`Update Payment - ${paymentModal.data?.invoice_no || ''}`}
        size="md"
      >
        {paymentModal.data && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{paymentModal.data.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-semibold">{formatCurrency(paymentModal.data.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="text-green-600 font-medium">{formatCurrency(paymentModal.data.amount_paid)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600 font-semibold">Amount Due:</span>
                <span className="text-red-600 font-bold">{formatCurrency(paymentModal.data.amount_due)}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmitPayment)} className="space-y-4">
              <FormInput
                label="Payment Amount"
                name="amount_paid"
                type="number"
                step="0.01"
                min="0.01"
                max={paymentModal.data.amount_due}
                value={paymentForm.amount_paid}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-gray-500">Maximum: {formatCurrency(paymentModal.data.amount_due)}</p>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Payment Mode *</label>
                <select
                  name="payment_mode"
                  value={paymentForm.payment_mode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {PAYMENT_MODES.map(mode => (
                    <option key={mode} value={mode.toLowerCase()}>{mode}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button type="button" onClick={() => { paymentModal.closeModal(); resetForm(); }} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  Update Payment
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={detailsModal.isOpen}
        onClose={detailsModal.closeModal}
        title={`Transaction Details - ${detailsModal.data?.invoice_no || ''}`}
        size="xl"
      >
        {detailsModal.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <h4 className="font-semibold mb-2 text-gray-700">Customer Information</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {detailsModal.data.customer_name || 'Walk-in Customer'}</p>
                  <p><strong>Phone:</strong> {detailsModal.data.customer_phone || 'N/A'}</p>
                  <p><strong>Address:</strong> {detailsModal.data.customer_address || 'N/A'}</p>
                  <p><strong>GST:</strong> {detailsModal.data.customer_gst || 'N/A'}</p>
                  <p><strong>DL:</strong> {detailsModal.data.customer_dl || 'N/A'}</p>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-gray-700">Payment Information</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Date:</strong> {formatDate(detailsModal.data.created_at)}</p>
                  <p><strong>Payment Mode:</strong> {detailsModal.data.payment_mode}</p>
                  <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs font-medium ${
                    detailsModal.data.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                    detailsModal.data.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{detailsModal.data.payment_status}</span></p>
                  <p><strong>Total Amount:</strong> {formatCurrency(detailsModal.data.total_amount)}</p>
                  <p><strong>Amount Paid:</strong> <span className="text-green-600">{formatCurrency(detailsModal.data.amount_paid)}</span></p>
                  <p><strong>Amount Due:</strong> <span className="text-red-600">{formatCurrency(detailsModal.data.amount_due)}</span></p>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-3 text-left font-semibold">Product</th>
                    <th className="px-2 py-3 text-left font-semibold">Batch</th>
                    <th className="px-2 py-3 text-left font-semibold">Qty</th>
                    <th className="px-2 py-3 text-left font-semibold">Rate</th>
                    <th className="px-2 py-3 text-left font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsModal.data.items && detailsModal.data.items.length > 0 ? (
                    detailsModal.data.items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="px-2 py-2">{item.medicine_name}</td>
                        <td className="px-2 py-2">{item.batch || 'N/A'}</td>
                        <td className="px-2 py-2">{item.quantity}</td>
                        <td className="px-2 py-2">{formatCurrency(item.rate)}</td>
                        <td className="px-2 py-2 font-semibold">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-2 py-8 text-center text-gray-500">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-right border-t pt-4">
              <div className="text-2xl font-bold text-green-600">
                Total: {formatCurrency(detailsModal.data.total_amount)}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Invoice Modal */}
      {invoiceModal.isOpen && invoiceData && (
        <GSTInvoice
          invoiceData={invoiceData}
          onClose={invoiceModal.closeModal}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={deleteConfirm.closeModal}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message={`Delete transaction ${deleteConfirm.data?.invoice_no}? Stock will be adjusted.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default Transactions;