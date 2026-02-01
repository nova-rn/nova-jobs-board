// Proxy to VPS API
const VPS_API = 'http://188.245.240.223:8091/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const response = await fetch(`${VPS_API}/stats`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error', open: 0, completed: 0, totalRewards: 0, totalPaid: 0 });
  }
}
