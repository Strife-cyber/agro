# Business Endpoints Documentation

## Overview

These specialized endpoints extend the basic CRUD functionality with complex business logic specific to the agro B2B platform. Each endpoint handles specific workflows with proper validation, role-based access control, and audit logging.

## 🏭 **Approvisionnement Workflow** (`/api/approvisionnements/workflow`)

### **Purpose**
Handles the complete supply chain workflow from supplier proposal to stock reception.

### **Workflow Steps**
1. **Supplier** creates approvisionnement (status: `pending`)
2. **Business Developer** validates/rejects (status: `validated_bd` / `rejected`)
3. **Stock Manager** receives/rejects physical stock (status: `received` / `rejected`)

### **Available Actions**
- `validate_bd` - Business Developer validates approvisionnement
- `reject_bd` - Business Developer rejects approvisionnement
- `receive_stock` - Stock Manager receives physical stock
- `reject_stock` - Stock Manager rejects physical stock

### **Business Rules**
- Only Business Developers can validate/reject approvisionnements
- Only Stock Managers can receive/reject physical stock
- When stock is received, inventory is automatically updated
- Payment to supplier is triggered when stock is received
- All actions are logged for audit trail

### **Example Usage**
```json
POST /api/approvisionnements/workflow
{
  "approvisionnement_id": "uuid",
  "action": "validate_bd",
  "notes": "Product quality meets standards"
}
```

---

## 🛒 **Order Processing** (`/api/orders/process`)

### **Purpose**
Handles complete order processing with stock validation and automatic inventory updates.

### **Processing Steps**
1. Validate stock availability for all items
2. Calculate total amount with markup
3. Create order and order items
4. Update stock quantities
5. Create delivery record (if delivery option selected)
6. Process payment
7. Send notifications

### **Business Rules**
- Stock must be available for all items
- Orders can only be placed by authenticated clients
- Stock is automatically decremented when order is placed
- Payment is processed immediately for direct payments
- Credit payments are marked as pending
- Delivery is automatically created if delivery option is selected

### **Stock Validation**
- Checks if sufficient stock exists for each product
- Validates stock is in the correct warehouse
- Prevents overselling

### **Example Usage**
```json
POST /api/orders/process
{
  "client_id": "user-id",
  "warehouse_id": "uuid",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 10,
      "unit_price": 25.50
    }
  ],
  "delivery_option": true,
  "delivery_address": "123 Main St",
  "payment_method": "direct"
}
```

---

## 📦 **Stock Management** (`/api/stocks/management`)

### **Purpose**
Handles comprehensive stock management operations including adjustments, transfers, reports, and alerts.

### **Available Actions**
- `adjust` - Adjust stock quantities (add/remove)
- `transfer` - Transfer stock between warehouses
- `report` - Generate inventory reports
- `alert` - Set up low stock alerts

### **Business Rules**
- Only Stock Managers and Admins can manage stock
- All stock adjustments are logged for audit trail
- Stock transfers require validation of source warehouse
- Low stock alerts are automatically triggered
- Inventory reports include detailed analytics

### **Stock Adjustment**
- Can add or remove stock quantities
- Requires reason for adjustment
- Updates last_updated timestamp
- Logs all changes for audit

### **Stock Transfer**
- Validates source warehouse has sufficient stock
- Creates transfer record
- Updates both source and destination warehouses
- Maintains audit trail

### **Inventory Reports**
- Current stock levels by warehouse
- Low stock items
- Stock movement history
- Value calculations

### **Example Usage**

#### Stock Adjustment
```json
POST /api/stocks/management
{
  "action": "adjust",
  "product_id": "uuid",
  "warehouse_id": "uuid",
  "quantity": 50,
  "reason": "Manual correction"
}
```

#### Stock Transfer
```json
POST /api/stocks/management
{
  "action": "transfer",
  "product_id": "uuid",
  "from_warehouse_id": "uuid",
  "to_warehouse_id": "uuid",
  "quantity": 25,
  "reason": "Redistribution"
}
```

#### Inventory Report
```json
POST /api/stocks/management
{
  "action": "report"
}
```

#### Stock Alert
```json
POST /api/stocks/management
{
  "action": "alert",
  "product_id": "uuid",
  "threshold": 10
}
```

---

## 🔐 **Security Features**

### **Authentication**
- All endpoints require authentication via middleware
- User data is retrieved from request headers

### **Role-Based Access Control**
- **Approvisionnement Workflow**: Business Developers and Stock Managers
- **Order Processing**: Clients and Admins
- **Stock Management**: Stock Managers and Admins

### **Audit Logging**
- All business actions are logged to `transaction_logs`
- Includes user ID, action details, and timestamps
- Maintains complete audit trail

### **Data Validation**
- Zod schemas validate all input data
- Business rules are enforced at the API level
- Proper error handling and responses

---

## 📊 **Response Format**

All endpoints follow a standardized response format:

### **Success Response**
```json
{
  "data": {...},
  "message": "Action completed successfully"
}
```

### **Error Response**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...} // Only in development
}
```

---

## 🚀 **Next Steps**

1. **Real-time Features**: Add WebSocket support for live updates
2. **Payment Integration**: Connect with actual payment gateways
3. **GPS Tracking**: Implement Google Maps integration for deliveries
4. **Advanced Analytics**: Add business intelligence and reporting
5. **Mobile API**: Create mobile-specific endpoints
6. **Bulk Operations**: Add support for bulk processing
7. **Caching**: Implement Redis caching for performance
8. **Rate Limiting**: Add business-specific rate limiting rules

---

## 📝 **Testing**

Each endpoint can be tested using the following pattern:

1. **Authentication**: Ensure user is logged in
2. **Role Validation**: Verify user has correct role
3. **Data Validation**: Test with valid and invalid data
4. **Business Logic**: Verify business rules are enforced
5. **Audit Trail**: Check that actions are properly logged

### **Test Examples**

```bash
# Test Approvisionnement Workflow
curl -X POST /api/approvisionnements/workflow \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"approvisionnement_id":"uuid","action":"validate_bd"}'

# Test Order Processing
curl -X POST /api/orders/process \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"user-id","warehouse_id":"uuid","items":[...]}'

# Test Stock Management
curl -X POST /api/stocks/management \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"action":"report"}'
```
