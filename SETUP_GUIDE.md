# Phase 2 UX Enhancements - Setup & Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- MySQL database running
- `.env` file in backend directory

### Step 1: Install Dependencies (if not already done)

**Backend:**
```bash
cd backend
npm install nodemailer twilio pdfkit
```

**Frontend:**
```bash
cd frontend
npm install react-hot-toast
```

### Step 2: Configure Environment Variables

Create/update `.env` file in backend root:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pharmacy_erp

# Server
PORT=5000
NODE_ENV=development

# Email Configuration (Optional - for email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourpharmacy.com

# WhatsApp Configuration (Optional - for WhatsApp delivery)
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1234567890
```

### Step 3: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Should see: 🏥 Sri Raghavendra Medical - API Server
# 🚀 Server: http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# Should see: Compiled successfully!
```

---

## 📋 Feature Verification Checklist

### ✅ Keyboard Shortcuts
- [ ] Open Billing page, press **Ctrl+S** - should focus on input/submit
- [ ] Press **Ctrl+N** - should open "Add Medicine" dialog
- [ ] Press **Esc** - should close any open dialog
- [ ] Open any page, press **/** - should focus search input
- [ ] Press **F2** - should navigate to Billing
- [ ] Press **F3** - should navigate to Inventory  
- [ ] Press **F4** - should navigate to Customers

### ✅ Loading States
- [ ] In Billing page, add a medicine to cart
- [ ] Should show animated skeleton loaders while loading
- [ ] No "Loading more..." text, only visual animations

### ✅ Dark Mode
- [ ] Toggle dark mode using the theme button (top right)
- [ ] Modal and dialogs should adapt colors
- [ ] Text should remain readable in both light and dark modes
- [ ] Icons should be visible in both themes

### ✅ Filter Presets
- [ ] Go to Customers page
- [ ] Click "Advanced Filters" 
- [ ] Set some filters (e.g., date range, customer type)
- [ ] Click "Save Preset" and name it "Active Customers"
- [ ] Refresh the page
- [ ] The preset should still be available in dropdown
- [ ] Click preset name to instantly apply saved filters

### ✅ Autocomplete Search
- [ ] Go to Billing page, start typing medicine name
- [ ] Should show dropdown with suggestions
- [ ] Use arrow keys (↑↓) to navigate suggestions
- [ ] Press Enter to select highlighted suggestion
- [ ] Press Esc to close suggestion dropdown

### ✅ Server-Side Pagination
- [ ] Go to Customers page
- [ ] Change "Items per page" from 10 to 25, 50, or 100
- [ ] Should load correct number of items
- [ ] "Total: X" should show correct count
- [ ] Try clicking "Next" and "Prev" buttons
- [ ] Should efficiently load data from server

### ✅ FIFO Batch Intelligence
- [ ] Go to Billing page
- [ ] Add a medicine with multiple batches (different expiry dates)
- [ ] Should show modal with batch selection
- [ ] Oldest batch should be highlighted with orange "Oldest" badge
- [ ] If you select non-FIFO batch, should show warning toast
- [ ] Toggle "Show Oldest First" should reorder batches
- [ ] Batch details should show "days_to_expiry" and expiry status

### ✅ Print & Email & WhatsApp (Setup Email First!)
- [ ] Go to any invoice, click GSTInvoice modal
- [ ] Should see 5 buttons: Download PDF, Email, WhatsApp, Print, Close

#### Download PDF:
- [ ] Click "Download PDF" button
- [ ] Browser should download invoice as PDF file
- [ ] Toast should show "PDF downloaded successfully!"

#### Email Delivery:
- [ ] First, configure SMTP in `.env` (see Configuration section)
- [ ] Restart backend server
- [ ] Click "Email" button in invoice modal
- [ ] Dialog should appear asking for email address
- [ ] Pre-filled with customer's email if available
- [ ] Enter valid email (e.g., test@gmail.com)
- [ ] Click "Send Email"
- [ ] Should show loading toast "Sending invoice via email..."
- [ ] After ~2-3 seconds, should show success toast
- [ ] Check email inbox for invoice (may be in spam)

#### WhatsApp Delivery:
- [ ] First, configure Twilio in `.env` (see Configuration section)
- [ ] Restart backend server
- [ ] Click "WhatsApp" button in invoice modal
- [ ] Dialog should appear asking for phone number
- [ ] Pre-filled with customer's phone if available
- [ ] Enter valid phone (e.g., 9876543210 or +919876543210)
- [ ] Click "Send WhatsApp"
- [ ] Should show loading toast "Sending invoice via WhatsApp..."
- [ ] After send, should show success toast
- [ ] Check WhatsApp chat for message (WhatsApp Business Account required)

#### Browser Print:
- [ ] Click "Print" button
- [ ] Browser print dialog should open
- [ ] Select printer and settings
- [ ] Click "Print" to print invoice
- [ ] Check printer output

---

## 🔧 Configuration Guides

### Gmail SMTP Setup

1. **Create App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your OS)
   - Google will generate a 16-character app password
   - Copy this password

2. **Update .env:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=noreply@yourpharmacy.com
```

3. **Test:**
   - Restart backend
   - Send a test email from GSTInvoice modal
   - Check inbox and spam folder

### Twilio WhatsApp Setup

1. **Create Twilio Account:**
   - Go to https://www.twilio.com/console
   - Create an account (you get free credits)
   - Go to "Messaging" > "Sandbox"
   - Copy Account SID and Auth Token
   - Get the Sandbox Phone Number (looks like: +1234567890)

2. **Enable WhatsApp Sandbox:**
   - Go to Twilio Console > "Messaging" > "Try it out"
   - Follow sandbox setup steps
   - You'll get sandbox credentials

3. **Update .env:**
```env
TWILIO_ACCOUNT_SID=your_account_sid_from_console
TWILIO_AUTH_TOKEN=your_auth_token_from_console
TWILIO_FROM_NUMBER=+1234567890
```

4. **Test:**
   - Restart backend
   - Send a test message from GSTInvoice modal
   - Should receive WhatsApp message on your phone

### Thermal Printer Setup

1. **Hardware Requirements:**
   - 80mm thermal printer (ESC/POS compatible)
   - USB or Serial connection to computer
   - Printer drivers installed

2. **Download PDF:**
   - Click "Download PDF" for thermal format
   - Send binary file to thermal printer
   - Should print compact receipt format

3. **Alternative - Send to Printer:**
   - Use print server software (e.g., PrintNode, Apiculator)
   - Configure it to receive ESC/POS commands
   - Backend will send thermal format to printer

---

## 🐛 Troubleshooting

### Keyboard Shortcuts Not Working
- **Check:** KeyboardShortcuts.jsx component is mounted
- **Fix:** Ensure page component includes `<KeyboardShortcuts ... />`
- **Test:** Check browser console for errors

### Filter Presets Not Saving
- **Check:** localStorage is enabled in browser
- **Fix:** Clear browser cache and try again
- **Test:** Open DevTools > Application > Local Storage

### Email Not Sending
- **Check:** SMTP config in `.env` is correct
- **Logs:** Check backend console for error messages
- **Common Issues:**
  - App password not copied correctly (should be 16 chars)
  - 2-factor authentication not enabled on Gmail
  - Firewall blocking SMTP port 587
- **Fix:** Disable Gmail security temporarily for testing:
  - Go to https://myaccount.google.com/lesssecureapps
  - Enable "Less Secure App Access" (not recommended for production)

### WhatsApp Not Sending
- **Check:** Twilio sandbox is enabled
- **Logs:** Check backend console for error messages
- **Common Issues:**
  - Account SID or Auth Token is wrong
  - Sandbox not properly configured
  - Phone number not verified in sandbox
- **Fix:** Verify in Twilio Console:
  - Messaging > Sandbox > verify your phone number
  - Try sending from Twilio console first

### PDF Not Generating
- **Check:** PDFKit is installed (`npm list pdfkit`)
- **Logs:** Check backend console for error messages
- **Common Issues:**
  - Invoice data missing fields
  - Invalid invoice format
- **Fix:** Ensure invoiceData has all required fields:
  - invoice_no, customer, items, total, grand_total

### Dark Mode Not Working
- **Check:** Tailwind dark mode is enabled in config
- **Test:** Toggle theme button in top right
- **Common Issues:**
  - Missing `dark:` prefix classes
  - useTheme hook not returning proper value
- **Fix:** Check Modal.jsx has: `const { isDark } = useTheme()`

---

## 📊 Performance Tips

1. **Pagination for Large Datasets:**
   - Always set reasonable page sizes (10, 25, 50)
   - Backend pagination prevents loading all records

2. **Filter Presets:**
   - localStorage limits ~5MB per domain
   - With 1000s of presets, consider database
   - Current implementation suitable for <100 presets

3. **Email Delivery:**
   - Sending large PDFs (>5MB) may timeout
   - Consider compression or splitting
   - Use queue system for bulk sends

4. **Print Operations:**
   - PDF generation is synchronous
   - Large invoices (>100 items) may take 1-2 seconds
   - Browser print dialog may hang - reload if stuck

---

## 🔐 Security Notes

1. **Never commit .env to Git:**
```bash
echo ".env" >> .gitignore
```

2. **Rotate Credentials Regularly:**
   - Change SMTP app password every 3 months
   - Rotate Twilio API tokens periodically

3. **Validate User Input:**
   - Email format validated with regex
   - Phone numbers validated for min 10 digits
   - Backend validates all inputs

4. **Limit API Rates:**
   - Consider adding rate limiting to print routes
   - Prevent spam sending via email/WhatsApp
   - Backend should track sending frequency

---

## 📝 Notes for Production Deployment

1. **Update Database Schema (if needed):**
   - Current implementation doesn't require new tables
   - Filter presets stored client-side (localStorage)
   - Print logs can be added to existing tables

2. **Environment Variables:**
   - Use secure vault (AWS Secrets Manager, HashiCorp Vault)
   - Never hardcode credentials
   - Rotate tokens regularly

3. **SMTP Configuration:**
   - Use dedicated email service (SendGrid, Mailgun)
   - More reliable than Gmail SMTP
   - Better deliverability and reporting

4. **WhatsApp Business:**
   - Upgrade from Sandbox to Business Account
   - Requires approval from Meta
   - Allows sending to any number (not just sandbox)

5. **Thermal Printer:**
   - Deploy print server software on pharmacy device
   - Configure network printing for multi-location setup
   - Test paper quality and formatting

6. **Backup Filters:**
   - Export filter presets periodically
   - Use `localStorage.getItem('filter_presets')`
   - Store in database for persistence

---

## 📞 Quick Reference

| Feature | Keyboard | Status | Config Required |
|---------|----------|--------|-----------------|
| Keyboard Shortcuts | Ctrl+S, Ctrl+N, Esc, F2-F4 | ✅ Ready | No |
| Dark Mode | Theme toggle button | ✅ Ready | No |
| Filter Presets | Click "Save Preset" | ✅ Ready | No |
| Autocomplete | Type to search | ✅ Ready | No |
| Pagination | Select page size | ✅ Ready | No |
| FIFO Warnings | Auto-show | ✅ Ready | No |
| PDF Download | Click "Download PDF" | ✅ Ready | No |
| Email Sending | Click "Email" | ⚠️ Requires SMTP | Yes (.env) |
| WhatsApp Sending | Click "WhatsApp" | ⚠️ Requires Twilio | Yes (.env) |
| Browser Print | Click "Print" | ✅ Ready | No |
| Thermal Printer | Download PDF > Send to Device | ✅ Ready | Hardware |

---

## 🎓 Learning Resources

- [React Hooks Guide](https://react.dev/reference/react/hooks)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [PDFKit Documentation](http://pdfkit.org/)
- [Nodemailer Guide](https://nodemailer.com/about/)
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)
- [ESC/POS Command Reference](https://en.wikipedia.org/wiki/Thermal_printer#Printing)

---

Generated: Phase 2 Setup Guide
Last Updated: 2024
Status: ✅ Complete
