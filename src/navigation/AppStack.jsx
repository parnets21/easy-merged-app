// src/navigation/AppStack.jsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { theme } from '../utils/theme';
import BottomTabNavigator from './BottomTabNavigator';
import AccessDenied from '../components/AccessDenied';
import usePermissions from '../hooks/usePermissions';

/**
 * guard(moduleKey, Component)
 * Wraps a screen so a role without access to `moduleKey` sees AccessDenied
 * instead of the real screen — closes the gap where tabs/quick-actions are
 * hidden but the screen is still reachable via navigation.
 */
function guard(moduleKey, Component) {
  return function GuardedScreen(props) {
    const { can } = usePermissions();
    if (moduleKey && !can(moduleKey)) return <AccessDenied {...props} />;
    return <Component {...props} />;
  };
}

// ── Enquiry ──────────────────────────────────────────────────
import EnquiryDetailScreen      from '../screens/enquiry/EnquiryDetailScreen';
import CreateEnquiryScreen      from '../screens/enquiry/CreateEnquiryScreen';

// ── Orders ───────────────────────────────────────────────────
import OrderListScreen          from '../screens/order/OrderListScreen';
import OrderDetailScreen        from '../screens/order/OrderDetailScreen';
import OrderStatusUpdateScreen  from '../screens/order/OrderStatusUpdateScreen';
import OrderEntryScreen         from '../screens/order/OrderEntryScreen';

// ── Products — View + Add ────────────────────────────────────
import ProductDetailScreen      from '../screens/product/ProductDetailScreen';
import AddProductScreen         from '../screens/product/AddProductScreen';
import CategoryBrandManagerScreen from '../screens/product/CategoryBrandManagerScreen';

// ── Purchase (Buy items) ─────────────────────────────────────
import PurchaseEntryScreen      from '../screens/purchase/PurchaseEntryScreen';
import PurchaseListScreen       from '../screens/purchase/PurchaseListScreen';

// ── Quotations (request → admin quote → accept/reject) ───────
import QuotationListScreen      from '../screens/quotation/QuotationListScreen';
import ProductRequestScreen     from '../screens/quotation/ProductRequestScreen';

// ── Invoices (generated after admin approves an order) ───────
import InvoiceListScreen        from '../screens/invoice/InvoiceListScreen';
import InvoiceDetailScreen      from '../screens/invoice/InvoiceDetailScreen';

// ── Dispatch ─────────────────────────────────────────────────
import DispatchEntryScreen      from '../screens/dispatch/DispatchEntryScreen';
import DispatchTrackingScreen   from '../screens/dispatch/DispatchTrackingScreen';

// ── Customers ────────────────────────────────────────────────
import CustomerListScreen       from '../screens/customer/CustomerListScreen';
import CustomerProfileScreen    from '../screens/customer/CustomerProfileScreen';
import CustomerHistoryScreen    from '../screens/customer/CustomerHistoryScreen';
import AddCustomerScreen        from '../screens/customer/AddCustomerScreen';

// ── Leads & Follow-ups ───────────────────────────────────────
import LeadListScreen           from '../screens/lead/LeadListScreen';

// ── Sales ────────────────────────────────────────────────────
import SalesEntryScreen         from '../screens/sales/SalesEntryScreen';
import SalesListScreen          from '../screens/sales/SalesListScreen';
import SalesReportScreen        from '../screens/sales/SalesReportScreen';

// ── Payments ─────────────────────────────────────────────────
import PaymentReceivableScreen  from '../screens/payment/PaymentReceivableScreen';
import PaymentPayableScreen     from '../screens/payment/PaymentPayableScreen';
import PaymentEntryScreen       from '../screens/payment/PaymentEntryScreen';

// ── Accounts ─────────────────────────────────────────────────
import CustomerLedgerScreen    from '../screens/accounts/CustomerLedgerScreen';
import AccountsScreen          from '../screens/accounts/AccountsScreen';

// ── Finance ──────────────────────────────────────────────────
import PLDashboardScreen        from '../screens/profitloss/PLDashboardScreen';
import ExpenseEntryScreen       from '../screens/expense/ExpenseEntryScreen';
import ExpenseListScreen        from '../screens/expense/ExpenseListScreen';
import ExpenseReportScreen      from '../screens/expense/ExpenseReportScreen';

// ── Inventory ────────────────────────────────────────────────
import InventoryScreen          from '../screens/inventory/InventoryScreen';
import StockAdjustScreen        from '../screens/inventory/StockAdjustScreen';
import StockTransferScreen      from '../screens/inventory/StockTransferScreen';
import WarehouseListScreen      from '../screens/inventory/WarehouseListScreen';

// ── Notifications & Reports ───────────────────────────────────
import NotificationListScreen   from '../screens/notifications/NotificationListScreen';
import AnalyticsDashboardScreen from '../screens/reports/AnalyticsDashboardScreen';
import ReportCenterScreen       from '../screens/reports/ReportCenterScreen';

// ── Staff ─────────────────────────────────────────────────────
import StaffListScreen          from '../screens/staff/StaffListScreen';
import AddStaffScreen           from '../screens/staff/AddStaffScreen';

// ── Profile / Settings ────────────────────────────────────────
import ProfileScreen            from '../screens/settings/ProfileScreen';
import SubscriptionPlanScreen   from '../screens/settings/SubscriptionPlanScreen';
import DocumentListScreen       from '../screens/settings/DocumentListScreen';

// ── Tools ─────────────────────────────────────────────────────
import StoneCalculationScreen   from '../screens/tools/StoneCalculationScreen';

const Stack = createNativeStackNavigator();

const H = {
  headerStyle:      { backgroundColor: theme.colors.primary },
  headerTintColor:  '#fff',
  headerTitleStyle: { fontWeight: '700' },
  headerShown:      true,
};

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />

      {/* ── Enquiry ── */}
      <Stack.Screen name="EnquiryDetail"     component={guard('enquiries', EnquiryDetailScreen)}     options={{ headerShown: false }} />
      {/* A wholesaler may also RAISE a broadcast — it goes to every retailer,
          every wholesaler and the Admin team (backend `broadcastEnquiry`). */}
      <Stack.Screen name="CreateEnquiry"     component={guard('enquiries', CreateEnquiryScreen)}     options={{ headerShown: false }} />

      {/* ── Orders ── */}
      <Stack.Screen name="OrderList"         component={guard('orders', OrderListScreen)}         options={{ headerShown: false }} />
      <Stack.Screen name="OrderEntry"        component={guard('orders', OrderEntryScreen)}        options={{ headerShown: false }} />
      <Stack.Screen name="OrderDetail"       component={guard('orders', OrderDetailScreen)}       options={{ ...H, title: 'Order Detail' }} />
      <Stack.Screen name="OrderStatusUpdate" component={guard('orders', OrderStatusUpdateScreen)} options={{ ...H, title: 'Update Status' }} />

      {/* ── Products ── */}
      <Stack.Screen name="ProductDetail" component={guard('products', ProductDetailScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="AddProduct"    component={guard('products', AddProductScreen)}    options={{ headerShown: false }} />
      <Stack.Screen name="CategoryBrandManager" component={guard('products', CategoryBrandManagerScreen)} options={{ headerShown: false }} />

      {/* ── Purchase (Buy) ── */}
      <Stack.Screen name="PurchaseEntry" component={guard('purchases', PurchaseEntryScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="PurchaseList"  component={guard('purchases', PurchaseListScreen)}  options={{ headerShown: false }} />

      {/* ── Quotations ── */}
      <Stack.Screen name="QuotationList"  component={guard('quotations', QuotationListScreen)}  options={{ headerShown: false }} />
      <Stack.Screen name="ProductRequest" component={guard('quotations', ProductRequestScreen)} options={{ headerShown: false }} />

      {/* ── Invoices ── */}
      <Stack.Screen name="InvoiceList"   component={guard('invoices', InvoiceListScreen)}   options={{ headerShown: false }} />
      <Stack.Screen name="InvoiceDetail" component={guard('invoices', InvoiceDetailScreen)} options={{ headerShown: false }} />

      {/* ── Dispatch ── */}
      <Stack.Screen name="DispatchEntry"     component={guard('dispatches', DispatchEntryScreen)}     options={{ ...H, title: 'New Dispatch' }} />
      <Stack.Screen name="DispatchTracking"  component={guard('dispatches', DispatchTrackingScreen)}  options={{ ...H, title: 'Dispatch Tracking' }} />

      {/* ── Customers ── */}
      <Stack.Screen name="CustomerList"      component={guard('customers', CustomerListScreen)}      options={{ ...H, title: 'Customers' }} />
      <Stack.Screen name="AddCustomer"       component={guard('customers', AddCustomerScreen)}       options={{ headerShown: false }} />
      <Stack.Screen name="CustomerProfile"   component={guard('customers', CustomerProfileScreen)}   options={{ ...H, title: 'Customer Profile' }} />
      <Stack.Screen name="CustomerHistory"   component={guard('customers', CustomerHistoryScreen)}   options={{ ...H, title: 'History' }} />

      {/* ── Leads & Follow-ups ── */}
      <Stack.Screen name="LeadList"          component={guard('leads', LeadListScreen)}              options={{ headerShown: false }} />

      {/* ── Sales ── */}
      <Stack.Screen name="SalesEntry"        component={guard('sales', SalesEntryScreen)}        options={{ ...H, title: 'New Sale' }} />
      <Stack.Screen name="SalesList"         component={guard('sales', SalesListScreen)}         options={{ ...H, title: 'Sales' }} />
      <Stack.Screen name="SalesReport"       component={guard('sales', SalesReportScreen)}       options={{ ...H, title: 'Sales Report' }} />

      {/* ── Payments ── */}
      <Stack.Screen name="PaymentReceivable" component={guard('payments', PaymentReceivableScreen)} options={{ ...H, title: 'Payment Receivable' }} />
      <Stack.Screen name="PaymentPayable"    component={guard('payments', PaymentPayableScreen)}    options={{ ...H, title: 'Payment Payable' }} />
      <Stack.Screen name="PaymentEntry"      component={guard('payments', PaymentEntryScreen)}      options={{ ...H, title: 'Payment Entry' }} />

      {/* ── Accounts ── */}
      <Stack.Screen name="Accounts"       component={guard('accounts', AccountsScreen)}       options={{ ...H, title: 'Accounts' }} />
      <Stack.Screen name="CustomerLedger" component={guard('accounts', CustomerLedgerScreen)} options={{ ...H, title: 'Customer Ledger' }} />

      {/* ── Finance ── */}
      <Stack.Screen name="PLDashboard"       component={guard('profit_loss', PLDashboardScreen)}   options={{ ...H, title: 'Profit & Loss' }} />
      <Stack.Screen name="ExpenseEntry"      component={guard('expenses', ExpenseEntryScreen)}     options={{ ...H, title: 'New Expense' }} />
      <Stack.Screen name="ExpenseList"       component={guard('expenses', ExpenseListScreen)}      options={{ ...H, title: 'Expenses' }} />
      <Stack.Screen name="ExpenseReport"     component={guard('expenses', ExpenseReportScreen)}    options={{ ...H, title: 'Expense Report' }} />

      {/* ── Inventory ── */}
      <Stack.Screen name="Inventory"     component={guard('inventory', InventoryScreen)}   options={{ ...H, title: 'Stock Management' }} />
      <Stack.Screen name="StockAdjust"   component={guard('inventory', StockAdjustScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="StockTransfer" component={guard('stock_transfer', StockTransferScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="WarehouseList" component={guard('warehouses', WarehouseListScreen)}     options={{ headerShown: false }} />

      {/* ── Notifications & Reports ── */}
      <Stack.Screen name="NotificationList"   component={NotificationListScreen}   options={{ ...H, title: 'Notifications' }} />
      <Stack.Screen name="ReportCenter"       component={guard('reports', ReportCenterScreen)}       options={{ headerShown: false }} />
      <Stack.Screen name="AnalyticsDashboard" component={guard('reports', AnalyticsDashboardScreen)} options={{ ...H, title: 'Analytics' }} />

      {/* ── Staff ── */}
      <Stack.Screen name="StaffList" component={guard('staff', StaffListScreen)} options={{ headerShown: false }} />
      <Stack.Screen name="AddStaff"  component={guard('staff', AddStaffScreen)}  options={{ headerShown: false }} />

      {/* ── Profile / Settings ── */}
      <Stack.Screen name="DocumentList"     component={DocumentListScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="Profile"          component={ProfileScreen}          options={{ ...H, title: 'My Profile' }} />
      <Stack.Screen name="SubscriptionPlan" component={SubscriptionPlanScreen} options={{ ...H, title: 'Subscription' }} />

      {/* ── Tools ── */}
      <Stack.Screen name="StoneCalculation" component={StoneCalculationScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
