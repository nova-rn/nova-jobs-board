// Proxy to VPS API (server-side, bypasses mixed content)
const VPS_API = 'http://188.245.240.223:8091/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Extract path from URL - handle both /api/jobs and /api/jobs/xxx formats
    const url = new URL(req.url, `http://${req.headers.host}`);
    let path = url.pathname.replace('/api/jobs', '') || '';
    
    // Ensure path starts correctly
    if (!path.startsWith('/') && path.length > 0) {
      path = '/' + path;
    }
    
    const targetUrl = `${VPS_API}/jobs${path}${url.search}`;
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (req.headers['x-token']) {
      fetchOptions.headers['X-Token'] = req.headers['x-token'];
    }
    
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', details: error.message });
  }
}
