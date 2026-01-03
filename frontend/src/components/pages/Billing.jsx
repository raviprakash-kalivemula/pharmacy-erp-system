// src/components/pages/Billing.jsx - COMPLETE WITH BARCODE SCANNER
import React, { useState, useRef, useCallback, useEffect } from 'react';
import api from '../../api';
import useFetch from '../../hooks/useFetch';
import useModal from '../../hooks/useModal';
import useRealtime from '../../hooks/useRealtime';
import Button from '../common/Button';
import Modal from '../common/Modal';
import SearchBar from '../common/SearchBar';
import BarcodeInput from '../common/BarcodeInput';
import SkeletonLoader from '../common/SkeletonLoader';
import KeyboardShortcuts from '../common/KeyboardShortcuts';
import { Search, X, Eye, Check, Package, AlertTriangle, Barcode as BarcodeIcon } from 'lucide-react';
import GSTInvoice from './GSTInvoice';
import { formatCurrency } from '../../utils/formatters';
import { calculateBillTotals, calculatePaymentStatus } from '../../utils/calculations';
import { PAYMENT_MODES, GST_RATES } from '../../constants';
import toastQueue from '../../utils/toastQueue';

const Billing = () => {
  const [medicines, setMedicines] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Real-time edit locking
  const user = JSON.parse(localStorage.getItem('user')) || { id: 'unknown', username: 'User' };
  const { onEditLocked } = useRealtime(user?.id, user?.username);
  const [editingUsers, setEditingUsers] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeSearchTerm, setBarcodeSearchTerm] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [gstPercent, setGstPercent] = useState(5);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [sortOldestFirst, setSortOldestFirst] = useState(false);

  const { data: customersResponse } = useFetch(() => api.get('/customers'));
  const customers = customersResponse?.customers || [];
  const batchModal = useModal();
  const previewModal = useModal();
  const invoiceModal = useModal();

  // Listen to edit lock events
  useEffect(() => {
    if (!user?.id) return;
    
    const unsubscribe = onEditLocked?.((data) => {
      setEditingUsers(prev => ({
        ...prev,
        [data.documentId]: data.userId
      }));
      if (data.userId !== user.id) {
        toastQueue.warning(`${data.userId} is editing purchase ${data.documentId}`);
      }
    });
    
    return unsubscribe;
  }, [user?.id, onEditLocked]);

  const observer = useRef();
  const lastMedicineRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  React.useEffect(() => {
    fetchMedicines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm]);

  React.useEffect(() => {
    setMedicines([]);
    setPage(0);
    setHasMore(true);
  }, [searchTerm]);

  const fetchMedicines = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      const limit = 50;
      const offset = page * limit;
      
      const response = await api.get('/medicines', {
        params: { limit, offset, search: searchTerm }
      });
      
      const data = response.data.medicines || response.data;
      const total = response.data.total;
      
      if (page === 0) {
        setMedicines(Array.isArray(data) ? data : []);
      } else {
        setMedicines(prev => [...prev, ...(Array.isArray(data) ? data : [])]);
      }
      
      setHasMore(data.length === limit && medicines.length + data.length < total);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  // Handle barcode scan
  const handleBarcodeDetected = async (barcode) => {
    try {
      toastQueue.loading('Searching for barcode...', { id: 'barcode-search' });
      
      // Search for medicine by barcode
      const response = await api.get('/medicines', {
        params: { search: barcode, limit: 1 }
      });
      
      const data = response.data.medicines || response.data;
      
      if (!data || data.length === 0) {
        toastQueue.error(`No medicine found with barcode: ${barcode}`, { id: 'barcode-search' });
        return;
      }
      
      const medicine = data[0];
      toastQueue.success(`Found: ${medicine.name}`, { id: 'barcode-search' });
      
      // Automatically add to cart
      await handleMedicineSelect(medicine);
      
      // Clear barcode input
      setBarcodeSearchTerm('');
      
    } catch (error) {
      console.error('Barcode search error:', error);
      toastQueue.error('Error searching barcode', { id: 'barcode-search' });
    }
  };

  const handleMedicineSelect = async (medicine) => {
    if (medicine.total_stock === 0) {
      toastQueue.error('Out of stock!');
      return;
    }

    try {
      const res = await api.get(`/medicines/${medicine.id}/available-batches`);
      const batches = res.data;

      if (batches.length === 0) {
        toastQueue.error('No available batches');
        return;
      }

      if (batches.length === 1) {
        addToCartWithBatch(medicine, batches[0]);
      } else {
        setSelectedMedicine(medicine);
        setAvailableBatches(batches);
        batchModal.openModal();
      }
    } catch (error) {
      console.error('Error:', error);
      toastQueue.error('Error fetching batches');
    }
  };

  const addToCartWithBatch = (medicine, batch) => {
    const cartKey = `${medicine.id}-${batch.id}`;
    const existing = cart.find(c => c.cartKey === cartKey);

    if (existing) {
      if (existing.quantity >= batch.stock) {
        toastQueue.error(`Only ${batch.stock} units available in this batch`);
        return;
      }
      setCart(cart.map(c => c.cartKey === cartKey ? {...c, quantity: c.quantity + 1} : c));
      toastQueue.success(`Quantity increased: ${medicine.name}`);
    } else {
      setCart([{
        cartKey,
        medicine_id: medicine.id,
        batch_id: batch.id,
        name: medicine.name,
        manufacturer: medicine.manufacturer || 'N/A',
        pack: medicine.pack || 'N/A',
        batch: batch.batch,
        expiry: batch.expiry,
        stock: batch.stock,
        mrp: batch.mrp,
        purchase_rate: parseFloat(batch.purchase_rate) || 0,
        selling_rate: parseFloat(batch.selling_rate) || 0,
        margin: parseFloat(batch.margin) || 0,
        hsn_code: medicine.hsn_code || '',
        quantity: 1,
        free_quantity: 0,
        gst_percent: 5,
        expiry_status: batch.expiry_status,
        days_to_expiry: batch.days_to_expiry
      }, ...cart]);
      toastQueue.success(`Added to cart: ${medicine.name}`);
    }
    batchModal.closeModal();
  };

  const updateQuantity = (cartKey, quantity) => {
    if (quantity < 1) return;
    const item = cart.find(c => c.cartKey === cartKey);
    if (quantity > item.stock) {
      toastQueue.error(`Only ${item.stock} units available`);
      return;
    }
    setCart(cart.map(c => c.cartKey === cartKey ? {...c, quantity} : c));
  };

  const updateFreeQuantity = (cartKey, freeQty) => {
    if (freeQty < 0) return;
    setCart(cart.map(c => c.cartKey === cartKey ? {...c, free_quantity: freeQty} : c));
  };

  const updateGST = (cartKey, gstPercent) => {
    setCart(cart.map(c => c.cartKey === cartKey ? {...c, gst_percent: gstPercent} : c));
  };

  const removeFromCart = (cartKey) => {
    setCart(cart.filter(c => c.cartKey !== cartKey));
  };

  const totals = calculateBillTotals(cart, discount, discountType, gstPercent);
  const amountDue = (totals.grandTotal || 0) - (parseFloat(amountPaid) || 0);

  const handlePaymentChange = (e) => {
    const paid = parseFloat(e.target.value) || 0;
    setAmountPaid(paid);
    setPaymentStatus(calculatePaymentStatus(paid, totals.grandTotal));
  };

  const handlePreview = async () => {
    if (cart.length === 0) {
      toastQueue.error('Please add items to cart');
      return;
    }
    if (!selectedCustomer) {
      toastQueue.error('Please select a customer');
      return;
    }

    try {
      const settingsRes = await api.get('/settings');
      const shopData = settingsRes.data;

      const preview = {
        customer: selectedCustomer,
        items: [...cart].reverse().map((item) => ({
          name: item.name,
          manufacturer: item.manufacturer,
          pack: item.pack,
          hsn_code: item.hsn_code,
          batch: item.batch,
          expiry: item.expiry,
          quantity: item.quantity,
          free_quantity: item.free_quantity,
          selling_rate: parseFloat(item.selling_rate) || 0,
          mrp: parseFloat(item.mrp) || 0,
          total: (parseFloat(item.selling_rate) || 0) * (parseInt(item.quantity) || 0),
          gst_percent: item.gst_percent
        })),
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountType,
        tax: totals.tax,
        grand_total: totals.grandTotal,
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        amount_due: amountDue,
        shop: shopData
      };

      setPreviewData(preview);
      previewModal.openModal();
    } catch (error) {
      console.error('Error loading preview:', error);
      toastQueue.error('Error loading preview');
    }
  };

  const generateBill = async () => {
    if (cart.length === 0) {
      toastQueue.error('Please add items to cart');
      return;
    }
    if (!selectedCustomer) {
      toastQueue.error('Please select a customer');
      return;
    }

    const billData = {
      customer: {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
        gst_number: selectedCustomer.gst_number,
        dl_number: selectedCustomer.dl_number
      },
      items: [...cart].reverse().map(item => ({
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        name: item.name,
        manufacturer: item.manufacturer,
        pack: item.pack,
        hsn_code: item.hsn_code,
        batch: item.batch,
        expiry: item.expiry,
        quantity: item.quantity,
        free_quantity: item.free_quantity,
        mrp: parseFloat(item.mrp) || 0,
        rate: parseFloat(item.selling_rate) || 0,
        amount: (parseFloat(item.selling_rate) || 0) * (parseInt(item.quantity) || 0),
        gst_percent: item.gst_percent
      })),
      payment: {
        mode: paymentMode,
        amount: amountPaid
      },
      totals: {
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountType: discountType,
        tax: totals.tax,
        grandTotal: totals.grandTotal
      }
    };

    try {
      const res = await api.post('/sales', billData);
      
      const settingsRes = await api.get('/settings');
      const shopData = settingsRes.data;

      const invoiceInfo = {
        invoice_no: res.data.invoiceNo,
        sale_date: new Date().toISOString().split('T')[0],
        customer: selectedCustomer,
        items: [...cart].reverse().map((item) => ({
          name: item.name,
          manufacturer: item.manufacturer || 'N/A',
          pack: item.pack || 'N/A',
          hsn_code: item.hsn_code || '',
          batch: item.batch,
          expiry: item.expiry,
          quantity: item.quantity,
          free_quantity: item.free_quantity,
          mrp: parseFloat(item.mrp) || 0,
          rate: parseFloat(item.selling_rate) || 0,
          price: parseFloat(item.selling_rate) || 0,
          total: (parseFloat(item.selling_rate) || 0) * (parseInt(item.quantity) || 0),
          gst_percent: item.gst_percent
        })),
        subtotal: totals.subtotal,
        discount: totals.discountAmount,
        discountType,
        tax: totals.tax,
        grand_total: totals.grandTotal,
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        amount_due: amountDue,
        shop: shopData
      };

      setInvoiceData(invoiceInfo);
      invoiceModal.openModal();
      previewModal.closeModal();
      
      toastQueue.success(`Bill generated successfully!\nInvoice: ${res.data.invoiceNo}`);
      
      setCart([]);
      setSelectedCustomer(null);
      setAmountPaid(0);
      setDiscount(0);
      setPaymentStatus('paid');
      fetchMedicines();
    } catch (error) {
      console.error('Error generating bill:', error);
      toastQueue.error('Error generating bill: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="space-y-6">
      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts 
        currentPage="billing" 
        onAddNew={() => {
          // Focus barcode input
          const barcodeInput = document.querySelector('input[placeholder*="Scan barcode"]');
          if (barcodeInput) barcodeInput.focus();
        }}
        onClose={() => {
          batchModal.closeModal();
          previewModal.closeModal();
          invoiceModal.closeModal();
        }}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Quick Billing</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <BarcodeIcon size={18} />
          <span>Scan or search medicines</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Medicine List */}
        <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow flex flex-col" style={{height: 'calc(100vh - 200px)'}}>
          <h3 className="font-semibold mb-3 flex-shrink-0">Select Medicines</h3>
          
          {/* BARCODE INPUT */}
          <div className="mb-4 flex-shrink-0">
            <BarcodeInput
              value={barcodeSearchTerm}
              onChange={setBarcodeSearchTerm}
              onBarcodeDetected={handleBarcodeDetected}
              placeholder="Scan barcode or search medicines..."
              showCameraButton={true}
              autoFocus={true}
            />
          </div>

          {/* REGULAR SEARCH (FALLBACK) */}
          <div className="relative mb-4 flex-shrink-0">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Or type to search..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-2">
            {medicines.map((medicine, index) => (
              <div 
                key={medicine.id} 
                ref={index === medicines.length - 1 ? lastMedicineRef : null}
                className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{medicine.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {medicine.pack && (
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                        <Package size={12} />
                        {medicine.pack}
                      </span>
                    )}
                    <span>Stock: <span className={`font-semibold ${medicine.total_stock <= 10 ? 'text-red-600' : 'text-green-600'}`}>{medicine.total_stock || 0}</span></span>
                    <span>Batches: {medicine.batch_count || 0}</span>
                    {medicine.nearest_expiry && (
                      <span className={`${
                        new Date(medicine.nearest_expiry) < new Date(Date.now() + 30*24*60*60*1000) ? 'text-red-500' :
                        new Date(medicine.nearest_expiry) < new Date(Date.now() + 90*24*60*60*1000) ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        Exp: {new Date(medicine.nearest_expiry).toLocaleDateString('en-IN', {month: 'short', year: '2-digit'})}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {medicine.lowest_selling_rate && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 leading-tight">Selling</p>
                    <p className="text-sm font-semibold text-green-600 leading-tight">₹{parseFloat(medicine.lowest_selling_rate).toFixed(2)}</p>
                  </div>
                  )}
                  {medicine.lowest_mrp && (
                 <div className="text-right">
                 <p className="text-xs text-gray-500 leading-tight">MRP</p>
                 <p className="text-sm font-semibold text-blue-600 leading-tight">₹{parseFloat(medicine.lowest_mrp).toFixed(2)}</p>
                 </div>
                  )}
                  <button 
                    onClick={() => handleMedicineSelect(medicine)}
                    disabled={!medicine.total_stock || medicine.total_stock === 0}
                    className="bg-blue-500 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="py-2">
                <div className="space-y-2">
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                  <div className="h-16 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="text-center mt-2 text-sm text-gray-500">Loading more medicines...</div>
              </div>
            )}
            {!hasMore && medicines.length > 0 && <div className="text-center py-2 text-sm text-gray-500">No more medicines</div>}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="bg-white p-4 rounded-lg shadow flex flex-col" style={{height: 'calc(100vh - 180px)'}}>
          <h3 className="font-semibold mb-3">Cart ({cart.length})</h3>

          <select 
            className="w-full mb-3 p-2 border rounded text-sm"
            value={selectedCustomer?.id || ''}
            onChange={(e) => setSelectedCustomer((customers || []).find(c => c.id === parseInt(e.target.value)))}
          >
            <option value="">Select Customer</option>
            {(customers || []).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>

          <div className="flex-1 overflow-y-auto mb-3 space-y-2 pr-2" style={{minHeight: '320px', maxHeight: '450px'}}>
            {cart.map(item => (
              <div key={item.cartKey} className={`p-2 rounded border ${
                item.expiry_status === 'critical' ? 'bg-red-50 border-red-200' :
                item.expiry_status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                        <Package size={10} />
                        {item.pack}
                      </span>
                      <span>•</span>
                      <span>{item.batch}</span>
                      <span>•</span>
                      <span>{new Date(item.expiry).toLocaleDateString('en-IN', {month: 'short', year: '2-digit'})}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.cartKey)} 
                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="flex gap-2 items-center mb-1">
                  <div className="flex items-center gap-1 border rounded">
                    <button 
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)} 
                      className="px-2 py-1 hover:bg-gray-200 text-sm"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => updateQuantity(item.cartKey, parseInt(e.target.value) || 1)} 
                      className="w-12 text-center border-x text-sm py-1"
                    />
                    <button 
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)} 
                      className="px-2 py-1 hover:bg-gray-200 text-sm"
                    >
                      +
                    </button>
                  </div>
                  
                  <input 
                    type="number" 
                    value={item.free_quantity} 
                    onChange={(e) => updateFreeQuantity(item.cartKey, parseInt(e.target.value) || 0)}
                    className="w-14 text-center border rounded text-sm py-1" 
                    placeholder="Free"
                    title="Free Qty"
                  />
                  
                  <select 
                    value={item.gst_percent}
                    onChange={(e) => updateGST(item.cartKey, parseFloat(e.target.value))}
                    className="text-sm border rounded py-1 px-1 flex-1"
                  >
                    {GST_RATES.map(rate => (
                      <option key={rate.value} value={rate.value}>{rate.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="text-sm text-gray-700">
                  ₹{(parseFloat(item.selling_rate) || 0).toFixed(2)} × {item.quantity} 
                  {item.free_quantity > 0 && <span className="text-green-600"> +{item.free_quantity}F</span>}
                  {' = '}
                  <span className="font-semibold">₹{((parseFloat(item.selling_rate) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}</span>
                </div>
                
                {item.margin > 0 && (
                  <div className="text-xs text-green-600 mt-1">
                    M: {item.margin.toFixed(1)}% (P: ₹{item.purchase_rate.toFixed(2)})
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t pt-2 space-y-1.5 flex-shrink-0">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            
            <div className="flex gap-2 items-center text-sm">
              <span className="whitespace-nowrap">Disc:</span>
              <select 
                value={discountType} 
                onChange={(e) => setDiscountType(e.target.value)}
                className="border rounded px-2 py-1 text-sm flex-shrink-0"
              >
                <option value="percentage">%</option>
                <option value="fixed">₹</option>
              </select>
              <input 
                type="number" 
                step="0.01" 
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="flex-1 border rounded px-2 py-1 text-sm min-w-0" 
                placeholder="0" 
              />
              <span className="text-red-600 font-medium whitespace-nowrap">
                -{formatCurrency(totals.discountAmount)}
              </span>
            </div>

            <div className="flex gap-2 items-center text-sm">
              <span className="whitespace-nowrap">GST:</span>
              <select 
                value={gstPercent} 
                onChange={(e) => setGstPercent(parseFloat(e.target.value))}
                className="border rounded px-2 py-1 text-sm flex-shrink-0"
              >
                {GST_RATES.map(rate => (
                  <option key={rate.value} value={rate.value}>{rate.label}</option>
                ))}
              </select>
              <span className="flex-1"></span>
              <span className="font-medium whitespace-nowrap">
                {formatCurrency(totals.tax)}
              </span>
            </div>

            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total:</span>
              <span className="text-green-600">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="space-y-2 border-t pt-2 mt-2 flex-shrink-0">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_MODES.map(mode => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`p-2 border rounded text-sm ${paymentMode === mode ? 'bg-blue-500 text-white' : 'hover:bg-blue-50'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount Paid (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0"
                className="w-full p-2 border rounded"
                value={amountPaid}
                onChange={handlePaymentChange}
              />
            </div>

            <div className={`p-2 rounded text-sm ${
              paymentStatus === 'paid' ? 'bg-green-50 border border-green-200' :
              paymentStatus === 'partial' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex justify-between mb-1">
                <span className="font-medium">Status:</span>
                <span className={`font-bold uppercase ${
                  paymentStatus === 'paid' ? 'text-green-600' :
                  paymentStatus === 'partial' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {paymentStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Due:</span>
                <span className={`font-bold ${amountDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(amountDue)}
                </span>
              </div>
            </div>

            <button 
              onClick={handlePreview}
              disabled={cart.length === 0 || !selectedCustomer}
              className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              <Eye size={16} /> Preview Bill
            </button>
          </div>
        </div>
      </div>

      {/* Batch Selection Modal */}
      <Modal
        isOpen={batchModal.isOpen}
        onClose={() => {
          batchModal.closeModal();
          setSortOldestFirst(false);
        }}
        title={`Select Batch - ${selectedMedicine?.name || ''}`}
        size="lg"
      >
        {selectedMedicine && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {selectedMedicine.pack && `Pack: ${selectedMedicine.pack}`}
            </p>

            {/* FIFO Warning and Sort Option */}
            {availableBatches.length > 1 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      💡 FIFO (First In, First Out) Available
                    </p>
                    <p className="text-xs text-blue-800">
                      Older batches should be sold first to minimize expiry loss.
                    </p>
                  </div>
                  <button
                    onClick={() => setSortOldestFirst(!sortOldestFirst)}
                    className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                      sortOldestFirst
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {sortOldestFirst ? '✓ Show Oldest First' : 'Show Oldest First'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(sortOldestFirst 
                ? [...availableBatches].sort((a, b) => new Date(a.expiry) - new Date(b.expiry))
                : availableBatches
              ).map((batch, index) => {
                const isOldestAvailable = index === 0 && availableBatches.length > 1;
                const isNotOldest = !sortOldestFirst && availableBatches[0]?.expiry < batch.expiry;
                
                return (
                  <div key={batch.id} 
                    onClick={() => {
                      if (isNotOldest) {
                        toastQueue.warning(`⚠️ Older batch (${availableBatches[0].batch}) still available. Consider using FIFO principle.`);
                      }
                      addToCartWithBatch(selectedMedicine, batch);
                      setSortOldestFirst(false);
                    }}
                    className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-all ${
                      isOldestAvailable ? 'ring-2 ring-green-500 ring-opacity-50' : ''
                    } ${
                      batch.expiry_status === 'critical' ? 'border-red-300 bg-red-50' :
                      batch.expiry_status === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                      isOldestAvailable ? 'border-green-300 bg-green-50' : 'hover:border-blue-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">Batch: {batch.batch}</p>
                          {isOldestAvailable && (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Oldest</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Expiry: {new Date(batch.expiry).toLocaleDateString('en-IN')}
                          <span className={`ml-2 font-medium ${
                            batch.expiry_status === 'critical' ? 'text-red-600' :
                            batch.expiry_status === 'warning' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            ({batch.days_to_expiry} days)
                          </span>
                        </p>
                        <p className="text-sm">Stock: {batch.stock} units</p>
                        <p className="text-xs text-gray-500 mt-1">MRP: {formatCurrency(batch.mrp)}</p>
                        {batch.margin > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            Margin: {parseFloat(batch.margin).toFixed(1)}% (Purchase: {formatCurrency(batch.purchase_rate)})
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Selling Rate</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(batch.selling_rate)}</p>
                      </div>
                    </div>
                    {batch.expiry_status !== 'good' && (
                      <div className={`mt-2 flex items-center gap-1 text-sm ${
                        batch.expiry_status === 'critical' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        <AlertTriangle size={14} />
                        {batch.expiry_status === 'critical' ? 'Expiring soon - Sell first!' : 'Near expiry date'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={previewModal.isOpen}
        onClose={previewModal.closeModal}
        title="Bill Preview"
        size="xl"
      >
        {previewData && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">Review all details before generating the final bill</p>
            </div>

            {/* Customer Details */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                Customer Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="font-medium">Name:</span> {previewData.customer.name}</div>
                <div><span className="font-medium">Phone:</span> {previewData.customer.phone || 'N/A'}</div>
                <div className="col-span-2"><span className="font-medium">Address:</span> {previewData.customer.address || 'N/A'}</div>
                <div><span className="font-medium">GST No:</span> {previewData.customer.gst_number || 'N/A'}</div>
                <div><span className="font-medium">DL No:</span> {previewData.customer.dl_number || 'N/A'}</div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <h4 className="font-semibold text-lg p-4 bg-gray-50 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                Items ({previewData.items.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Medicine</th>
                      <th className="px-3 py-2 text-center">Pack</th>
                      <th className="px-3 py-2 text-center">MFG</th>
                      <th className="px-3 py-2 text-center">Batch</th>
                      <th className="px-3 py-2 text-center">Expiry</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-center">Free</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">MRP</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">GST%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">HSN: {item.hsn_code || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            <Package size={10} />
                            {item.pack}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-xs">{item.manufacturer}</td>
                        <td className="px-3 py-2 text-center text-xs">{item.batch}</td>
                        <td className="px-3 py-2 text-center text-xs">
                          {new Date(item.expiry).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold">{item.quantity}</td>
                        <td className="px-3 py-2 text-center text-green-600 font-medium">
                          {item.free_quantity > 0 ? item.free_quantity : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.selling_rate)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatCurrency(item.mrp)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                        <td className="px-3 py-2 text-center">{item.gst_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
                Bill Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(previewData.subtotal)}</span>
                </div>
                {previewData.discount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount ({previewData.discountType === 'percentage' ? '%' : '₹'}):</span>
                    <span className="font-medium">-{formatCurrency(previewData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>After Discount:</span>
                  <span className="font-medium">{formatCurrency(previewData.subtotal - previewData.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST:</span>
                  <span className="font-medium">{formatCurrency(previewData.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                  <span>Grand Total:</span>
                  <span className="text-green-600">{formatCurrency(previewData.grand_total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">4</span>
                Payment Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-medium">{previewData.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-medium text-green-600">{formatCurrency(previewData.amount_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Due:</span>
                  <span className={`font-bold ${previewData.amount_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(previewData.amount_due)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Payment Status:</span>
                  <span className={`font-bold uppercase ${
                    previewData.payment_status === 'paid' ? 'text-green-600' :
                    previewData.payment_status === 'partial' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {previewData.payment_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={previewModal.closeModal}
                className="flex-1 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 flex items-center justify-center gap-2"
              >
                <X size={20} /> Go Back & Edit
              </button>
              <button
                onClick={generateBill}
                className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-semibold"
              >
                <Check size={20} /> Confirm & Generate Bill
              </button>
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
    </div>
  );
};

export default Billing;
