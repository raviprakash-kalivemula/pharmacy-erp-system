import React, { useState } from 'react';
import { Mail, MessageCircle, Printer, Download, X } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import toast from '../../utils/toast';
import api from '../../api';

const GSTInvoice = ({ invoiceData, onClose }) => {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState(invoiceData?.customer?.email || '');
  const [whatsappNumber, setWhatsappNumber] = useState(invoiceData?.customer?.phone || '');
  const [sending, setSending] = useState(false);
  // Add validation at the very beginning
  if (!invoiceData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <p className="text-red-600">Error: No invoice data provided</p>
          <button onClick={onClose} className="mt-4 bg-gray-500 text-white px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!invoiceData.items || !Array.isArray(invoiceData.items) || invoiceData.items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <p className="text-red-600">Error: Invalid or empty items in invoice</p>
          <button onClick={onClose} className="mt-4 bg-gray-500 text-white px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    );
  }

  const {
    invoice_no,
    sale_date,
    customer,
    items,
    subtotal,
    discount,
    discountType,
    tax,
    grand_total,
    payment_mode,
    payment_status,
    amount_paid,
    amount_due,
    shop
  } = invoiceData;

  const gstType = 'CGST+SGST';

  // Calculate GST breakdown by rate with safety checks
  const gstBreakdown = items.reduce((acc, item) => {
    const gstRate = item.gst_percent || 12;
    const gstRateKey = gstRate.toString();
    
    if (!acc[gstRateKey]) {
      acc[gstRateKey] = { taxable: 0, cgst: 0, sgst: 0 };
    }
    
    const itemTotal = parseFloat(item.total) || 0;
    const itemGst = (itemTotal * gstRate) / 100;
    
    acc[gstRateKey].taxable += itemTotal;
    acc[gstRateKey].cgst += itemGst / 2;
    acc[gstRateKey].sgst += itemGst / 2;
    
    return acc;
  }, {});

  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    if (num === 0) return 'Zero';
    
    let words = '';
    
    if (num >= 10000000) {
      words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
      num %= 10000000;
    }
    
    if (num >= 100000) {
      words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
      num %= 100000;
    }
    
    if (num >= 1000) {
      words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
      num %= 1000;
    }
    
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    
    if (num >= 20) {
      words += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      words += teens[num - 10] + ' ';
      return words.trim();
    }
    
    if (num > 0) {
      words += ones[num] + ' ';
    }
    
    return words.trim();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setSending(true);
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      
      const response = await api.post(`/print/pdf`, {
        invoiceData,
        format: 'a4'
      }, { responseType: 'blob' });
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceData.invoice_no}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentChild.removeChild(link);
      
      toast.success('PDF downloaded successfully!', { id: 'pdf-gen' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF', { id: 'pdf-gen' });
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setSending(true);
      toast.loading('Sending invoice via email...', { id: 'email-send' });
      
      const response = await api.post('/print/email', {
        invoiceData,
        recipientEmail: emailAddress
      });
      
      if (response.data.success) {
        toast.success(`Invoice sent to ${emailAddress}!`, { id: 'email-send' });
        setShowEmailDialog(false);
      } else {
        toast.error(response.data.error || 'Failed to send email', { id: 'email-send' });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email: ' + (error.response?.data?.error || error.message), { id: 'email-send' });
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappNumber || whatsappNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    try {
      setSending(true);
      toast.loading('Sending invoice via WhatsApp...', { id: 'whatsapp-send' });
      
      const response = await api.post('/print/whatsapp', {
        invoiceData,
        phoneNumber: whatsappNumber
      });
      
      if (response.data.success) {
        toast.success(`Invoice sent to ${whatsappNumber}!`, { id: 'whatsapp-send' });
        setShowWhatsAppDialog(false);
      } else {
        toast.error(response.data.error || 'Failed to send WhatsApp message', { id: 'whatsapp-send' });
      }
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast.error('Failed to send WhatsApp: ' + (error.response?.data?.error || error.message), { id: 'whatsapp-send' });
    } finally {
      setSending(false);
    }
  };

  const amountInWords = numberToWords(Math.round(grand_total || 0));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:block">
      <div className="bg-white w-full max-w-4xl max-h-[95vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible dark:bg-gray-900" id="invoice-container">
        {/* Buttons - Hidden in print */}
        <div className="flex justify-end gap-3 p-4 border-b no-print dark:border-gray-700 flex-wrap">
          <button
            onClick={handleDownloadPDF}
            disabled={sending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            <Download size={18} />
            Download PDF
          </button>
          <button
            onClick={() => setShowEmailDialog(true)}
            disabled={sending}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-purple-400"
          >
            <Mail size={18} />
            Email
          </button>
          <button
            onClick={() => setShowWhatsAppDialog(true)}
            disabled={sending}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-green-400"
          >
            <MessageCircle size={18} />
            WhatsApp
          </button>
          <button
            onClick={handlePrint}
            disabled={sending}
            className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-orange-400"
          >
            <Printer size={18} />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            <X size={18} />
            Close
          </button>
        </div>

        {/* Email Dialog */}
        <ConfirmDialog
          isOpen={showEmailDialog}
          title="Send Invoice via Email"
          message="Enter recipient email address:"
          onConfirm={handleSendEmail}
          onCancel={() => setShowEmailDialog(false)}
          confirmText={sending ? 'Sending...' : 'Send Email'}
          cancelText="Cancel"
          isLoading={sending}
          variant="primary"
          children={
            <div className="mt-4">
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                disabled={sending}
                autoFocus
              />
            </div>
          }
        />

        {/* WhatsApp Dialog */}
        <ConfirmDialog
          isOpen={showWhatsAppDialog}
          title="Send Invoice via WhatsApp"
          message="Enter recipient phone number:"
          onConfirm={handleSendWhatsApp}
          onCancel={() => setShowWhatsAppDialog(false)}
          confirmText={sending ? 'Sending...' : 'Send WhatsApp'}
          cancelText="Cancel"
          isLoading={sending}
          variant="primary"
          children={
            <div className="mt-4">
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+91 98765 43210 or 9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                disabled={sending}
                autoFocus
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Include country code (e.g., +91 for India) or just 10 digits
              </p>
            </div>
          }
        />

        {/* Invoice Content - This will be printed */}
        <div className="p-8 print:p-6" id="invoice-content" style={{fontFamily: '"Courier New", monospace', fontSize: '12px', lineHeight: '1.4'}}>
          
          <div className="text-center mb-2">
            <div style={{fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px'}}>TAX INVOICE</div>
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <div style={{flex: 1}}>
              <div style={{fontWeight: 'bold', fontSize: '14px'}}>{shop?.shop_name || 'N/A'}</div>
              <div style={{fontSize: '11px'}}>{shop?.address || 'N/A'}</div>
              <div style={{fontSize: '11px'}}>Ph: {shop?.phone || 'N/A'}</div>
            </div>
            <div style={{textAlign: 'right', fontSize: '11px'}}>
              <div>GST NO: {shop?.gst || 'N/A'}</div>
              <div>DL NO: {shop?.license || 'N/A'}</div>
            </div>
          </div>

          <div style={{borderTop: '1px dashed #666', margin: '8px 0'}}></div>

          <div style={{fontSize: '11px', marginBottom: '8px'}}>
            <div style={{display: 'grid', gridTemplateColumns: '33% 34% 33%', gap: '0', marginBottom: '4px'}}>
              <span>TO: {customer?.name || 'N/A'}</span>
              <span style={{textAlign: 'center'}}>GST No: {customer?.gst_number || 'N/A'}</span>
              <span style={{textAlign: 'right'}}>Invoice No: {invoice_no || 'N/A'}</span>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '33% 34% 33%', gap: '0', marginBottom: '4px'}}>
              <span>Address: {customer?.address || 'N/A'}</span>
              <span style={{textAlign: 'center'}}>DL No: {customer?.dl_number || 'N/A'}</span>
              <span style={{textAlign: 'right'}}>Date: {new Date(sale_date).toLocaleDateString('en-GB')}</span>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '33% 34% 33%', gap: '0'}}>
              <span>Phone No: {customer?.phone || 'N/A'}</span>
              <span style={{textAlign: 'center'}}>Payment: {payment_mode || 'N/A'}</span>
              <span style={{textAlign: 'right'}}>Status: {(payment_status || 'N/A').toUpperCase()}</span>
            </div>
          </div>

          <div style={{borderTop: '1px dashed #666', margin: '8px 0'}}></div>

          <table style={{width: '100%', fontSize: '10px', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '1px dotted #666'}}>
                <th style={{textAlign: 'left', padding: '3px 2px', width: '3%'}}>S.No</th>
                <th style={{textAlign: 'left', padding: '3px 2px', width: '5%'}}>HSNCODE</th>
                <th style={{textAlign: 'left', padding: '3px 2px', width: '15%'}}>PRODUCT NAME</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '6%'}}>PACK</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '7%'}}>MFG</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '7%'}}>BATCH</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '7%'}}>EXP</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '4%'}}>QTY</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '4%'}}>FREE</th>
                <th style={{textAlign: 'right', padding: '3px 2px', width: '7%'}}>M.R.P</th>
                <th style={{textAlign: 'right', padding: '3px 2px', width: '7%'}}>RATE</th>
                <th style={{textAlign: 'right', padding: '3px 2px', width: '9%'}}>AMOUNT</th>
                <th style={{textAlign: 'center', padding: '3px 2px', width: '5%'}}>GST%</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{borderBottom: '1px dotted #ccc'}}>
                  <td style={{padding: '3px 2px'}}>{index + 1}</td>
                  <td style={{padding: '3px 2px', fontSize: '9px'}}>{item.hsn_code || 'N/A'}</td>
                  <td style={{padding: '3px 2px'}}>{item.name || 'N/A'}</td>
                  <td style={{textAlign: 'center', padding: '3px 2px', fontSize: '9px'}}>
                    {item.pack || 'N/A'}
                  </td>
                  <td style={{textAlign: 'center', padding: '3px 2px', fontSize: '9px'}}>
                    {item.manufacturer || 'N/A'}
                  </td>
                  <td style={{textAlign: 'center', padding: '3px 2px'}}>{item.batch || 'N/A'}</td>
                  <td style={{textAlign: 'center', padding: '3px 2px'}}>
                    {item.expiry ? new Date(item.expiry).toLocaleDateString('en-GB').substring(3) : 'N/A'}
                  </td>
                  <td style={{textAlign: 'center', padding: '3px 2px'}}>{item.quantity || 0}</td>
                  <td style={{textAlign: 'center', padding: '3px 2px', color: (item.free_quantity || 0) > 0 ? '#16a34a' : '#666'}}>
                    {item.free_quantity || '-'}
                  </td>
                  <td style={{textAlign: 'right', padding: '3px 2px'}}>
                    {parseFloat(item.mrp || item.rate || item.price || 0).toFixed(2)}
                  </td>
                  <td style={{textAlign: 'right', padding: '3px 2px'}}>
                    {parseFloat(item.rate || item.price || 0).toFixed(2)}
                  </td>
                  <td style={{textAlign: 'right', padding: '3px 2px'}}>
                    {parseFloat(item.total || 0).toFixed(2)}
                  </td>
                  <td style={{textAlign: 'center', padding: '3px 2px'}}>{item.gst_percent || 12}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{borderTop: '1px dashed #666', margin: '8px 0'}}></div>

          <div style={{fontSize: '11px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
              <div style={{flex: 1}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead>
                    <tr style={{borderBottom: '1px dotted #666'}}>
                      <th style={{textAlign: 'left', padding: '3px', width: '15%'}}>GST%</th>
                      <th style={{textAlign: 'right', padding: '3px', width: '25%'}}>Taxable</th>
                      <th style={{textAlign: 'right', padding: '3px', width: '25%'}}>CGST</th>
                      <th style={{textAlign: 'right', padding: '3px', width: '25%'}}>SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(gstBreakdown).map(([rate, values]) => (
                      <tr key={rate} style={{borderBottom: '1px dotted #ddd'}}>
                        <td style={{padding: '3px'}}>{rate}%</td>
                        <td style={{textAlign: 'right', padding: '3px'}}>{values.taxable.toFixed(2)}</td>
                        <td style={{textAlign: 'right', padding: '3px'}}>{values.cgst.toFixed(2)}</td>
                        <td style={{textAlign: 'right', padding: '3px'}}>{values.sgst.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{marginLeft: '20px', textAlign: 'right', minWidth: '140px'}}>
                <div style={{marginBottom: '3px'}}>Subtotal: {parseFloat(subtotal || 0).toFixed(2)}</div>
                {(discount || 0) > 0 && (
                  <div style={{marginBottom: '3px', color: '#dc2626'}}>
                    Discount: -{parseFloat(discount || 0).toFixed(2)}
                  </div>
                )}
                <div style={{marginBottom: '3px'}}>GST Amt: {parseFloat(tax || 0).toFixed(2)}</div>
                <div style={{marginBottom: '3px'}}>Paid: {parseFloat(amount_paid || 0).toFixed(2)}</div>
                <div style={{marginBottom: '3px', color: (amount_due || 0) > 0 ? '#dc2626' : '#16a34a'}}>
                  Due: {parseFloat(amount_due || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div style={{borderTop: '1px dashed #666', margin: '8px 0'}}></div>

          <div style={{fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
            <span>Amount (in words): <strong>{amountInWords} Rupees Only</strong></span>
            <span style={{fontWeight: 'bold', fontSize: '13px'}}>Net Amount: ₹ {Math.round(grand_total || 0)}</span>
          </div>

          <div style={{borderTop: '1px dashed #666', margin: '8px 0'}}></div>

          <div style={{fontSize: '9px', marginTop: '8px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div style={{flex: 1}}>
                <div>All goods supplied in this invoice do not contravene section 18 of the Drugs and Cosmetics Act 1940.</div>
                <div style={{marginTop: '3px'}}>Subject to Hyderabad jurisdiction. E. & O. E.</div>
              </div>
              <div style={{textAlign: 'right', fontWeight: 'bold', marginLeft: '20px'}}>
                For {shop?.shop_name || 'N/A'}
              </div>
            </div>
            
            <div style={{marginTop: '20px'}}>
              <div>Customer's Signature</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          /* Hide everything first */
          body * {
            visibility: hidden;
          }
          
          /* Show only the invoice container and its children */
          #invoice-container,
          #invoice-container * {
            visibility: visible;
          }
          
          /* Position invoice at top of page */
          #invoice-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          
          /* Hide buttons in print */
          .no-print {
            display: none !important;
          }
          
          /* Remove modal styling for print */
          .fixed {
            position: static !important;
          }
          
          .bg-black\\/50 {
            background: white !important;
          }
          
          .max-w-4xl {
            max-width: none !important;
          }
          
          .overflow-y-auto {
            overflow: visible !important;
          }
          
          .max-h-\\[95vh\\] {
            max-height: none !important;
          }
          
          /* Page setup */
          @page {
            size: A4;
            margin: 10mm;
          }
          
          /* Ensure content fits on page */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default GSTInvoice;