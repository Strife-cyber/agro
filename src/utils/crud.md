# Enhanced CRUD Handler System

## Overview

The CRUD handler has been completely rewritten to provide a secure, validated, and feature-rich foundation for all API endpoints in the agro platform.

## Key Improvements

### 🔒 **Security Features**
- **Rate Limiting**: Built-in rate limiting (100 requests per 15 minutes per IP)
- **Input Sanitization**: Automatic sanitization of all inputs to prevent XSS
- **Role-Based Access Control**: Configurable role permissions for each endpoint
- **Authentication**: Integration with Stack authentication system
- **Audit Logging**: Complete audit trail of all CRUD operations

### ✅ **Validation & Error Handling**
- **Zod Schema Validation**: Type-safe validation for all inputs
- **Standardized Error Responses**: Consistent error format across all endpoints
- **Production-Safe Error Messages**: No sensitive information leaked in production
- **Request/Response Logging**: Performance monitoring and debugging

### 📊 **Enhanced Features**
- **Pagination**: Built-in pagination support with configurable limits
- **Soft Delete**: Optional soft delete functionality
- **Search & Filtering**: Extensible search and filtering capabilities
- **Standardized Responses**: Consistent success/error response format

## Usage

### Basic CRUD Handler

```typescript
import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { userSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'users',
  prisma,
  validationSchema: userSchema,
  allowedRoles: ['admin', 'business_developer'],
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | string | Prisma model name |
| `prisma` | PrismaClient | Prisma client instance |
| `validationSchema` | ZodSchema | Validation schema for inputs |
| `allowedRoles` | string[] | Array of allowed user roles |
| `enablePagination` | boolean | Enable pagination (default: false) |
| `enableSearch` | boolean | Enable search functionality (default: false) |
| `enableSoftDelete` | boolean | Enable soft delete (default: false) |
| `auditLog` | boolean | Enable audit logging (default: false) |

## API Endpoints

### GET /api/[model]
- **Single Record**: `GET /api/users?id=uuid`
- **Multiple Records**: `GET /api/users?page=1&limit=20`
- **Response Format**:
```json
{
  "data": [...],
  "message": "Records retrieved successfully",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### POST /api/[model]
- **Create Record**: `POST /api/users` with validated body
- **Response Format**:
```json
{
  "data": {...},
  "message": "Record created successfully"
}
```

### PUT /api/[model]
- **Update Record**: `PUT /api/users` with `{id, ...data}`
- **Response Format**:
```json
{
  "data": {...},
  "message": "Record updated successfully"
}
```

### DELETE /api/[model]
- **Delete Record**: `DELETE /api/users` with `{id}`
- **Response Format**:
```json
{
  "data": {...},
  "message": "Record deleted successfully"
}
```

## Error Responses

All errors follow a standardized format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...} // Only in development
}
```

### Common Error Codes
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid input data
- `NOT_FOUND`: Record not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Server error

## Validation Schemas

Pre-built validation schemas are available in `src/utils/validation-schemas.ts`:

- `userSchema` - User validation
- `productSchema` - Product validation
- `orderSchema` - Order validation
- `approvisionnementSchema` - Supply validation
- `stockSchema` - Stock validation
- `warehouseSchema` - Warehouse validation
- `categorySchema` - Category validation
- `deliverySchema` - Delivery validation
- `paymentSchema` - Payment validation
- `notificationSchema` - Notification validation

## Role-Based Access Control

The system supports the following roles:
- `admin` - Full access to all endpoints
- `business_developer` - Can manage suppliers and approvisionnements
- `stock_manager` - Can manage inventory and stock
- `supplier` - Can manage their own approvisionnements
- `client` - Can manage their own orders
- `driver` - Can manage deliveries

## Audit Logging

All CRUD operations are logged to the `transaction_logs` table with:
- Entity type and ID
- Action performed (CREATE, UPDATE, DELETE)
- User who performed the action
- Timestamp
- Additional details

## Security Best Practices

1. **Always use validation schemas** for input validation
2. **Configure appropriate role permissions** for each endpoint
3. **Enable audit logging** for sensitive operations
4. **Use soft delete** for data that shouldn't be permanently removed
5. **Monitor rate limiting** in production
6. **Review audit logs** regularly for security compliance

## Testing

A test endpoint is available at `/api/test-crud` for verifying the CRUD handler functionality.

## Next Steps

1. **Implement Stack Authentication Integration**: Connect with actual Stack user authentication
2. **Add Business Logic Validation**: Implement domain-specific validation rules
3. **Create Custom Endpoints**: Build specialized endpoints for complex operations
4. **Add Real-time Features**: Implement WebSocket support for live updates
5. **Performance Optimization**: Add caching and query optimization
