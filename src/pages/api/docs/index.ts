import { NextApiRequest, NextApiResponse } from 'next'

/**
 * API DOCUMENTATION ENDPOINT
 * 
 * This endpoint serves the OpenAPI/Swagger specification for the entire API.
 * It can be accessed by anyone without authentication for documentation purposes.
 * 
 * The documentation includes all endpoints with:
 * - Request/Response schemas
 * - Authentication requirements
 * - Business logic explanations
 * - Example requests/responses
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
    })
  }

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Agro B2B Food Distribution Platform API',
      description: `
# Agro B2B Food Distribution Platform API

This API provides comprehensive functionality for a B2B food distribution platform, including:

## Core Features
- **User Management**: Role-based access control (Admin, Business Developer, Stock Manager, Supplier, Client, Driver)
- **Product Management**: Categories, products, and inventory tracking
- **Supply Chain**: Approvisionnement workflow with validation and stock management
- **Order Processing**: Complete order lifecycle with payment integration
- **Warehouse Management**: Multi-warehouse stock tracking and transfers
- **Delivery System**: Driver assignment and delivery tracking
- **Payment Processing**: Multiple payment methods and transaction logging
- **Notifications**: Real-time alerts and communication system

## Authentication
All API endpoints require authentication via Stack authentication framework. The middleware automatically handles user authentication and role-based access control.

## Rate Limiting
API endpoints are protected with rate limiting (100 requests per 15 minutes per IP).

## Audit Trail
All significant actions are logged in the transaction_logs table for compliance and debugging.
      `,
      version: '1.0.0',
      contact: {
        name: 'Agro API Support',
        email: 'support@agro-platform.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://api.agro-platform.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Stack authentication token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { 
              type: 'string', 
              enum: ['admin', 'business_developer', 'stock_manager', 'supplier', 'client', 'driver'] 
            },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            unit: { type: 'string' },
            category_id: { type: 'string', format: 'uuid' },
            image_url: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            order_id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string', format: 'uuid' },
            warehouse_id: { type: 'string', format: 'uuid' },
            total_amount: { type: 'number' },
            status: { 
              type: 'string', 
              enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] 
            },
            delivery_option: { type: 'boolean' },
            payment_method: { 
              type: 'string', 
              enum: ['direct', 'credit'] 
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Stock: {
          type: 'object',
          properties: {
            stock_id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            warehouse_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            last_updated: { type: 'string', format: 'date-time' },
          },
        },
        Approvisionnement: {
          type: 'object',
          properties: {
            approvisionnement_id: { type: 'string', format: 'uuid' },
            supplier_id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            warehouse_id: { type: 'string', format: 'uuid' },
            quantity: { type: 'number' },
            proposed_price: { type: 'number' },
            status: { 
              type: 'string', 
              enum: ['pending', 'validated_bd', 'received', 'rejected'] 
            },
            delivery_date: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        responses: {
          BadRequest: {
            description: 'Bad request - validation error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                    details: { type: 'object' },
                  },
                },
              },
            },
          },
          Unauthorized: {
            description: 'Unauthorized - authentication required',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
          Forbidden: {
            description: 'Forbidden - insufficient permissions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
          NotFound: {
            description: 'Not found - resource does not exist',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
          InternalServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    code: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    paths: {
      // User Management
      '/users': {
        get: {
          summary: 'Get all users',
          description: 'Retrieve all users with pagination and filtering. Requires admin role.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'role', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Users retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
        post: {
          summary: 'Create a new user',
          description: 'Create a new user account. Requires admin role.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'name', 'role'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    address: { type: 'string' },
                    role: { 
                      type: 'string', 
                      enum: ['admin', 'business_developer', 'stock_manager', 'supplier', 'client', 'driver'] 
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/User' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/users/{id}': {
        get: {
          summary: 'Get user by ID',
          description: 'Retrieve a specific user by their ID.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'User retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/User' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        put: {
          summary: 'Update user',
          description: 'Update user information. Users can update their own profile, admins can update any user.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    phone: { type: 'string' },
                    address: { type: 'string' },
                    role: { 
                      type: 'string', 
                      enum: ['admin', 'business_developer', 'stock_manager', 'supplier', 'client', 'driver'] 
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'User updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/User' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          summary: 'Delete user',
          description: 'Delete a user account. Requires admin role.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'User deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/User' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      // Product Management
      '/products': {
        get: {
          summary: 'Get all products',
          description: 'Retrieve all products with pagination and filtering.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Products retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          summary: 'Create a new product',
          description: 'Create a new product. Requires admin or business_developer role.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'unit', 'category_id'],
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    unit: { type: 'string' },
                    category_id: { type: 'string', format: 'uuid' },
                    image_url: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Product created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Product' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },

      // Order Processing
      '/orders/process': {
        post: {
          summary: 'Process a new order',
          description: `
Process a complete order with the following workflow:
1. Validate stock availability for all items
2. Calculate total order amount
3. Create order and order items in database
4. Update stock quantities
5. Create delivery record
6. Process payment (placeholder)
7. Send notifications
8. Log all actions for audit trail

**Business Rules:**
- Only authenticated users can process orders
- Stock must be available in the specified warehouse
- Order total is calculated from item quantities and prices
- Stock is automatically reduced when order is processed
- Delivery record is created for tracking
- Payment processing is triggered (placeholder implementation)

**Validation Rules:**
- All required fields must be provided
- Product IDs must be valid UUIDs
- Quantities must be positive numbers
- Warehouse must exist and have sufficient stock

**Notifications:**
- Client receives order confirmation
- Warehouse staff is notified of new order
- All actions are logged in transaction_logs
          `,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['client_id', 'warehouse_id', 'items', 'payment_method'],
                  properties: {
                    client_id: { type: 'string', format: 'uuid' },
                    warehouse_id: { type: 'string', format: 'uuid' },
                    delivery_option: { type: 'boolean', default: false },
                    payment_method: { 
                      type: 'string', 
                      enum: ['direct', 'credit'] 
                    },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['product_id', 'quantity', 'unit_price'],
                        properties: {
                          product_id: { type: 'string', format: 'uuid' },
                          quantity: { type: 'number', minimum: 1 },
                          unit_price: { type: 'number', minimum: 0 },
                        },
                      },
                    },
                    delivery_address: { type: 'string' },
                    notes: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Order processed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          order: { $ref: '#/components/schemas/Order' },
                          orderItems: { type: 'array' },
                          delivery: { type: 'object' },
                        },
                      },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '500': { $ref: '#/components/responses/InternalServerError' },
          },
        },
      },

      // Stock Management
      '/stocks/management': {
        post: {
          summary: 'Stock management operations',
          description: `
Comprehensive stock management operations including:

**Available Actions:**
- **adjust**: Add or remove stock quantities
- **transfer**: Transfer stock between warehouses
- **report**: Generate inventory reports
- **alert**: Set up low stock alerts

**Business Rules:**
- Only Stock Managers and Admins can perform stock operations
- All operations are logged for audit trail
- Stock transfers require sufficient quantity in source warehouse
- Low stock alerts are automatically triggered
- Inventory reports include warehouse breakdowns

**Validation Rules:**
- All required fields must be provided
- Quantities must be positive numbers
- Warehouse IDs must be valid UUIDs
- Product IDs must be valid UUIDs

**Audit Trail:**
- All stock movements are logged
- User actions are tracked
- Detailed change history maintained
          `,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: { 
                      type: 'string', 
                      enum: ['adjust', 'transfer', 'report', 'alert'] 
                    },
                    // For adjust action
                    product_id: { type: 'string', format: 'uuid' },
                    warehouse_id: { type: 'string', format: 'uuid' },
                    quantity: { type: 'number' },
                    unit_price: { type: 'number' },
                    reason: { type: 'string' },
                    // For transfer action
                    from_warehouse_id: { type: 'string', format: 'uuid' },
                    to_warehouse_id: { type: 'string', format: 'uuid' },
                    // For alert action
                    threshold: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Stock operation completed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'object' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '500': { $ref: '#/components/responses/InternalServerError' },
          },
        },
      },

      // Approvisionnement Workflow
      '/approvisionnements/workflow': {
        post: {
          summary: 'Approvisionnement workflow operations',
          description: `
Complete approvisionnement workflow management:

**Workflow Steps:**
1. Supplier submits approvisionnement (pending)
2. Business Developer validates or rejects (validated_bd / rejected)
3. Stock Manager receives or rejects stock (received / rejected)

**Business Rules:**
- Only Business Developers can validate/reject approvisionnements
- Only Stock Managers can receive/reject stock
- All actions are logged for audit trail
- Notifications are sent to relevant parties
- Stock is automatically updated upon receipt

**Validation Rules:**
- Business Developer validation: pending → validated_bd
- Business Developer rejection: pending → rejected
- Stock Manager receipt: validated_bd → received
- Stock Manager rejection: validated_bd → rejected

**Notifications:**
- Stock Manager notified when Business Developer validates
- Business Developer notified when Stock Manager receives/rejects
- All actions logged in transaction_logs
          `,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action', 'approvisionnement_id'],
                  properties: {
                    action: { 
                      type: 'string', 
                      enum: ['validate_bd', 'reject_bd', 'receive_stock', 'reject_stock'] 
                    },
                    approvisionnement_id: { type: 'string', format: 'uuid' },
                    notes: { type: 'string' },
                    reason: { type: 'string' },
                    actual_quantity: { type: 'number' },
                    actual_price: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Workflow operation completed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Approvisionnement' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { $ref: '#/components/responses/InternalServerError' },
          },
        },
      },

      // Standard CRUD endpoints
      '/categories': {
        get: {
          summary: 'Get all categories',
          description: 'Retrieve all product categories.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Categories retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/warehouses': {
        get: {
          summary: 'Get all warehouses',
          description: 'Retrieve all warehouses.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Warehouses retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/stocks': {
        get: {
          summary: 'Get all stocks',
          description: 'Retrieve all stock levels with pagination.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Stocks retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Stock' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/orders': {
        get: {
          summary: 'Get all orders',
          description: 'Retrieve all orders with pagination and filtering.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'client_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Orders retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/approvisionnements': {
        get: {
          summary: 'Get all approvisionnements',
          description: 'Retrieve all approvisionnements with pagination and filtering.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'supplier_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Approvisionnements retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Approvisionnement' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/deliveries': {
        get: {
          summary: 'Get all deliveries',
          description: 'Retrieve all deliveries with pagination and filtering.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'driver_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Deliveries retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/payments': {
        get: {
          summary: 'Get all payments',
          description: 'Retrieve all payments with pagination and filtering.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
            { name: 'payment_method', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Payments retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/notifications': {
        get: {
          summary: 'Get all notifications',
          description: 'Retrieve all notifications for the authenticated user.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'type', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Notifications retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },

      '/transaction_logs': {
        get: {
          summary: 'Get transaction logs',
          description: 'Retrieve transaction logs for audit purposes. Requires admin role.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'entity_type', in: 'query', schema: { type: 'string' } },
            { name: 'action', in: 'query', schema: { type: 'string' } },
            { name: 'user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          ],
          responses: {
            '200': {
              description: 'Transaction logs retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { type: 'object' } },
                      message: { type: 'string' },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
    },
  }

  res.status(200).json(openApiSpec)
}
