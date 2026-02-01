import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId="cml3l6d4b01tzjv0c8fx7uhwr"
        config={{
          loginMethods: ['wallet', 'email'],
          appearance: {
            theme: 'dark',
            accentColor: '#10b981',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
      >
        <App />
      </PrivyProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
