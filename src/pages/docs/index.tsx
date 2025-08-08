import { useEffect, useState } from 'react'
import Head from 'next/head'
import { NextApiRequest, NextApiResponse } from 'next'

// Type for Swagger UI component
type SwaggerUIComponent = React.ComponentType<Record<string, unknown>>

/**
 * API DOCUMENTATION PAGE
 * 
 * This page provides a beautiful Swagger UI interface for the API documentation.
 * It can be accessed by anyone without authentication for documentation purposes.
 * 
 * Features:
 * - Interactive API documentation
 * - Try-it-out functionality
 * - Beautiful modern design
 * - Responsive layout
 * - Search functionality
 * - Code examples
 */
export default function ApiDocs() {
  const [swaggerUI, setSwaggerUI] = useState<SwaggerUIComponent | null>(null)

  useEffect(() => {
    // Dynamically import Swagger UI to avoid SSR issues
    const loadSwaggerUI = async () => {
      try {
        const SwaggerUI = (await import('swagger-ui-react')).default
        setSwaggerUI(SwaggerUI)
      } catch (error) {
        console.error('Failed to load Swagger UI:', error)
      }
    }

    loadSwaggerUI()
  }, [])

  const SwaggerUIComponent = swaggerUI

  return (
    <>
      <Head>
        <title>Agro API Documentation</title>
        <meta name="description" content="Comprehensive API documentation for the Agro B2B Food Distribution Platform" />
        <meta name="keywords" content="API, documentation, B2B, food distribution, agro" />
        <meta name="robots" content="index, follow" />
        
        {/* Swagger UI CSS */}
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
        
        {/* Custom styles */}
        <style jsx global>{`
          /* Custom styling for the documentation page */
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          }
          
          .swagger-ui {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          }
          
          .swagger-ui .topbar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px 0;
          }
          
          .swagger-ui .topbar .download-url-wrapper {
            display: none;
          }
          
          .swagger-ui .info {
            margin: 50px 0;
            padding: 0 20px;
          }
          
          .swagger-ui .info .title {
            color: #333;
            font-size: 36px;
            font-weight: 600;
            margin-bottom: 10px;
          }
          
          .swagger-ui .info .description {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
          }
          
          .swagger-ui .scheme-container {
            background: #f8f9fa;
            border-radius: 8px;
            margin: 20px 0;
            padding: 20px;
          }
          
          .swagger-ui .opblock {
            border-radius: 8px;
            margin: 10px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .swagger-ui .opblock.opblock-get {
            border-color: #61affe;
            background: rgba(97, 175, 254, 0.1);
          }
          
          .swagger-ui .opblock.opblock-post {
            border-color: #49cc90;
            background: rgba(73, 204, 144, 0.1);
          }
          
          .swagger-ui .opblock.opblock-put {
            border-color: #fca130;
            background: rgba(252, 161, 48, 0.1);
          }
          
          .swagger-ui .opblock.opblock-delete {
            border-color: #f93e3e;
            background: rgba(249, 62, 62, 0.1);
          }
          
          .swagger-ui .opblock .opblock-summary {
            padding: 15px 20px;
          }
          
          .swagger-ui .opblock .opblock-summary-method {
            border-radius: 4px;
            font-weight: 600;
            padding: 4px 8px;
          }
          
          .swagger-ui .opblock .opblock-summary-path {
            font-weight: 500;
            color: #333;
          }
          
          .swagger-ui .opblock .opblock-summary-description {
            color: #666;
          }
          
          .swagger-ui .opblock .opblock-body {
            padding: 20px;
          }
          
          .swagger-ui .btn.execute {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 4px;
            color: white;
            font-weight: 600;
            padding: 8px 16px;
            transition: all 0.3s ease;
          }
          
          .swagger-ui .btn.execute:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
          
          .swagger-ui .responses-table {
            border-radius: 8px;
            overflow: hidden;
          }
          
          .swagger-ui .responses-table .response {
            border-radius: 4px;
            margin: 5px 0;
          }
          
          .swagger-ui .model {
            border-radius: 8px;
            overflow: hidden;
          }
          
          .swagger-ui .model-box {
            border-radius: 4px;
            margin: 5px 0;
          }
          
          /* Custom header */
          .api-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          
          .api-header h1 {
            font-size: 48px;
            font-weight: 700;
            margin: 0 0 10px 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
          }
          
          .api-header p {
            font-size: 20px;
            margin: 0;
            opacity: 0.9;
          }
          
          .api-header .version {
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            display: inline-block;
            font-size: 14px;
            font-weight: 600;
            margin-top: 15px;
            padding: 8px 16px;
          }
          
          /* Loading state */
          .loading {
            align-items: center;
            display: flex;
            flex-direction: column;
            height: 100vh;
            justify-content: center;
            text-align: center;
          }
          
          .loading h2 {
            color: #333;
            font-size: 24px;
            margin-bottom: 20px;
          }
          
          .loading .spinner {
            animation: spin 1s linear infinite;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            height: 40px;
            width: 40px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* Responsive design */
          @media (max-width: 768px) {
            .api-header h1 {
              font-size: 32px;
            }
            
            .api-header p {
              font-size: 16px;
            }
            
            .swagger-ui .info .title {
              font-size: 28px;
            }
          }
        `}</style>
      </Head>

      <div className="api-docs">
        {/* Custom Header */}
        <div className="api-header">
          <h1>🌾 Agro API Documentation</h1>
          <p>Comprehensive B2B Food Distribution Platform API</p>
          <div className="version">v1.0.0</div>
        </div>

        {/* Swagger UI Component */}
        {SwaggerUIComponent ? (
          <SwaggerUIComponent
            url="/api/docs"
            docExpansion="list"
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={2}
            displayOperationId={false}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
            requestInterceptor={(request: NextApiRequest) => {
              // Add any request interceptors if needed
              return request
            }}
            responseInterceptor={(response: NextApiResponse) => {
              // Add any response interceptors if needed
              return response
            }}
            onComplete={() => {
              // Custom completion handler
              console.log('Swagger UI loaded successfully')
            }}
            plugins={[
              () => ({
                statePlugins: {
                  spec: {
                    wrapSelectors: {
                      allowTryItOutFor: () => () => true
                    }
                  }
                }
              })
            ]}
          />
        ) : (
          <div className="loading">
            <h2>Loading API Documentation...</h2>
            <div className="spinner"></div>
            <p>Please wait while we load the interactive documentation</p>
          </div>
        )}
      </div>
    </>
  )
}
