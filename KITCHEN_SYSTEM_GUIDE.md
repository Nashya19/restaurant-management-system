# Kitchen Display System - Complete Guide

## Overview
Your restaurant now has a complete real-time kitchen management system where:
- Kitchen staff get a modern, mobile-friendly interface to manage orders
- Customers see live updates of their order progress
- All updates sync in real-time across devices

---

## For Kitchen Staff

### Accessing the Kitchen Display

1. **Login** to the admin/staff account
2. **Click "Kitchen Display"** in the sidebar (only visible for admin/staff)
3. You'll see:
   - **Header Section**: Active orders, total items, items preparing, items ready
   - **Live Order Queue**: List of all active orders
   - **Item Status Tracking**: Individual items within each order

### How to Track Orders

#### Step 1: Order Appears (Status: "Placed")
When a customer places an order from their table, it appears in the kitchen display with:
- Order ID
- Estimated wait time
- List of all items (status: "Pending")
- **Button**: "Start order" (orange)

#### Step 2: Start Preparing Items
Click the orange **"Start order"** button to transition the order status from "Placed" to "Preparing"

OR click **"Start preparing"** on individual items to transition them from "Pending" to "Preparing"

**What happens:**
- Item badge changes to orange ("Preparing")
- Customer sees in real-time: "Preparing Your Order" with countdown
- Timer shows estimated remaining time

#### Step 3: Item is Done
When an item is finished cooking, click the green **"Mark done"** button on that item

**What happens:**
- Item badge changes to green ("Ready")
- Customer sees in real-time: Item is "Ready"
- An estimated pickup time displays for the customer
- The item shows with checkmark icon

#### Step 4: Complete Order
When ALL items in an order are ready, click **"Mark order ready"** button at the top

**What happens:**
- Order status changes from "Preparing" to "Ready"
- Customer sees: "Order is ready to collect from counter"

---

## For Customers

### Viewing Your Order Progress

1. **Place Your Order**:
   - Browse menu on your device
   - Add items to cart
   - Click "Place Order"
   - Message: "Order sent to the kitchen! 🎉"

2. **See Live Progress**:
   - Order automatically appears in "Order History"
   - See all items with their status badges:
     - ⚪ **Pending**: Just received, hasn't started cooking
     - 🟠 **Preparing**: Currently being cooked
     - 🟢 **Ready**: Done, will reach your table soon

3. **Live Updates**:
   - Your page updates automatically (no refresh needed)
   - See estimated wait time at top of page
   - Each item shows current status in real-time

4. **Notification Flow**:
   ```
   Place Order
       ↓
   [Order is placed - items show as "Pending"]
       ↓
   Kitchen staff clicks "Start preparing"
       ↓
   [You see items change to "Preparing"]
       ↓
   Kitchen staff clicks "Mark done" on each item
       ↓
   [You see items change to "Ready"]
       ↓
   Staff clicks "Mark order ready"
       ↓
   [You see "Order ready!" notification]
   ```

---

## Real-Time Features

### ⚡ What's Real-Time?
- ✅ Order status changes (placed → preparing → ready)
- ✅ Individual item status updates
- ✅ Estimated wait time updates
- ✅ Item badges and visual indicators
- ✅ Order summary stats

### 🔄 How Often Does It Update?
- Automatic on kitchen staff action (0-1 second delay)
- No need to refresh - all changes appear immediately
- Works across multiple devices at the same table

### 📱 Works on Any Device
- Desktop/Tablet: Full dashboard layout
- Mobile: Responsive layout (stacked view)
- Both kitchen staff and customers see live updates

---

## UI Guide

### Kitchen Display Layout

```
┌─ HEADER ─────────────────────────┐
│ Kitchen Display                   │
│ Kitchen order queue              │
│ [Active Orders] [Total Items]   │
│ [Preparing] [Ready]             │
├─ ORDER CARDS ────────────────────┤
│ Order ID: XYZ123                 │
│ Status: [Placed] [Start order]   │
│ Est Wait: 15 mins                │
│                                  │
│ ├─ Items in this order           │
│ │ ├─ Pasta Carbonara x2 [Ready] │
│ │ │   [Mark done]                │
│ │ ├─ Caesar Salad x1 [Preparing]│
│ │ │   [Mark done]                │
│ │ └─ Bread x3 [Pending]         │
│ │     [Start preparing]          │
│ │                                │
└─────────────────────────────────┘
```

### Customer Order View

```
┌─ HEADER ──────────────────────┐
│ Table 1 Orders                │
│ PIN: 1234                     │
├─ WAIT TIME ───────────────────┤
│ ⏱ Preparing Your Order        │
│ Estimated: 12 mins remaining  │
├─ ORDER HISTORY ───────────────┤
│ Order #1                      │
│ Status: [Preparing]           │
│                               │
│ Items:                        │
│ • Pasta Carbonara x2  🟠      │
│ • Caesar Salad x1     🟢      │
│ • Bread x3           ⚪      │
│                               │
│ Order Total: $45.99          │
└───────────────────────────────┘
```

---

## Status Color Guide

| Color | Status | Meaning | Who Updates |
|-------|--------|---------|-------------|
| ⚪ Gray | Pending | Just received from customer | - |
| 🟠 Orange | Preparing | Currently being cooked | Kitchen staff |
| 🟢 Green | Ready | Done, will reach table soon | Kitchen staff |

---

## Common Workflows

### Workflow 1: Single Item Order
```
Customer orders: 1 Burger

Kitchen:
1. See new order with item "Pending"
2. Click "Start preparing" on burger
3. Burger becomes "Preparing" (orange)
4. When done, click "Mark done"
5. Burger becomes "Ready" (green)
6. Click "Mark order ready"

Customer sees:
- Order placed ✓
- Item "Preparing" (orange)
- Item "Ready" (green)
- "Order ready to collect!" message
```

### Workflow 2: Multi-Item Order (Items Ready at Different Times)
```
Customer orders: 
- Pasta (takes 12 mins)
- Salad (takes 5 mins)
- Bread (takes 3 mins)

Kitchen:
1. See new order with all items "Pending"
2. Click "Start order" to mark all as "Preparing"
3. Bread done first: Click "Mark done" on Bread
4. Salad done: Click "Mark done" on Salad
5. Pasta done: Click "Mark done" on Pasta
6. All items ready: Click "Mark order ready"

Customer sees:
- All items as "Preparing" 
- Bread changes to "Ready" after 3 mins
- Salad changes to "Ready" after 5 mins
- Pasta changes to "Ready" after 12 mins
- Finally sees "Order ready!"
```

### Workflow 3: Multiple Orders in Queue
```
Kitchen display shows:

Order #1 (5 mins old)
- Status: Preparing
- Items: 3 pending, 1 preparing, 1 ready
- [Mark order ready] button

Order #2 (2 mins old)
- Status: Placed
- Items: 2 pending
- [Start order] button

Order #3 (Just arrived)
- Status: Placed
- Items: 3 pending
- [Start order] button

You can manage multiple orders simultaneously!
```

---

## Tips for Efficient Kitchen Management

### ✅ Best Practices
1. **Start items early**: Click "Start preparing" as soon as order arrives
2. **Mark items ASAP**: Update status immediately when item status changes
3. **Check KPI stats**: Monitor "Preparing" and "Ready" counts at top
4. **Use item-level buttons**: For orders with multiple items at different times
5. **Check estimated wait**: Each order shows how long customer expects to wait

### ⏱ Keyboard Tips
- Large touch-friendly buttons (easy to tap even with gloved hands)
- Clear visual feedback on every action
- All info visible without scrolling (when possible)

---

## Troubleshooting

### Issue: Customer doesn't see order update
**Solution**: 
- Kitchen staff must click the status button (changes don't auto-save)
- Check customer page shows same order
- Refresh page if needed (usually not required)

### Issue: Order not appearing in kitchen display
**Solution**:
- Customer must click "Place Order" (not just add to cart)
- Check order went to kitchen (customer sees success message)
- Click refresh button in kitchen display header

### Issue: Multiple people manage one order
**Solution**:
- One person clicks "Start order" for all items
- Other staff click "Mark done" on individual items
- Last person clicks "Mark order ready" when complete
- No conflicts - last update wins

### Issue: Realtime updates not working
**Solution**:
- Check internet connection (realtime needs live connection)
- Refresh page (F5)
- Close other tabs/browsers (reduce network load)
- Contact admin if issue persists

---

## Advanced Features

### Real-Time Sync
- If 2 kitchen staff members update the same order simultaneously, the last update wins
- Refreshes appear within 1 second for all viewers
- Works even with network lag (up to 15 seconds)

### Mobile-Friendly Design
- Kitchen display works on tablets/phones
- Buttons sized for touch (48px minimum)
- Responsive layout for small screens
- Sidebar collapses on mobile

### Offline Handling
- If connection drops, changes queue locally
- Reconnects and syncs when online again
- Status updates appear when connection restored

---

## Sidebar Navigation

**Admin/Staff see:**
- 🏠 Dashboard
- 🍳 **Kitchen Display** ← You are here
- 📋 Tables
- 📦 Order Management
- 💰 Billing (Admin only)
- 📅 Schedule
- 👥 Users (Admin only)
- 🍽️ Menu

**Customers see:**
- 🍽️ Menu
- 📋 Order

---

## System Architecture

### How Real-Time Works

```
Kitchen staff updates item status
          ↓
Server updates database
          ↓
Supabase triggers realtime event
          ↓
Kitchen page receives update (Supabase channel)
Kitchen page reloads orders → UI updates
          ↓
Customer page receives update (Supabase channel)
Customer page reloads session → UI updates
          ↓
Both UIs show same status (real-time sync) ✓
```

---

## Support & Contact

For issues or feature requests:
- Check this guide first
- Restart the application
- Clear browser cache
- Contact system administrator

---

**Version**: 1.0  
**Last Updated**: 2025  
**System**: Restaurant Management System - Kitchen Display
