import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { CONTRACTS, ESCROW_ABI, ERC20_ABI, IDENTITY_ABI, REPUTATION_ABI, CHAIN_ID, formatReputation } from './contracts'

const API = '/api'

const publicClient = createPublicClient({
  chain: base,
  transport: http()
})

function App() {
  const { login, logout, authenticated, user, ready } = usePrivy()
  const { wallets } = useWallets()
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState({ open: 0, completed: 0, totalRewards: 0, totalPaid: 0, totalPending: 0 })
  const [showPostModal, setShowPostModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showSubsModal, setShowSubsModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showFundModal, setShowFundModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [currentJob, setCurrentJob] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState('all')
  const [myJobsOnly, setMyJobsOnly] = useState(false)
  const [activeTab, setActiveTab] = useState('jobs')
  const [escrowData, setEscrowData] = useState({})
  const [agentData, setAgentData] = useState({}) // wallet => { agentId, reputation }
  const [myAgentId, setMyAgentId] = useState(null)

  const address = user?.wallet?.address
  
  const filteredJobs = jobs.filter(job => {
    if (filter !== 'all' && job.status !== filter) return false
    if (myJobsOnly && address) {
      const isMyPost = job.poster_wallet?.toLowerCase() === address.toLowerCase()
      const isMyWin = job.winner_wallet?.toLowerCase() === address.toLowerCase()
      if (!isMyPost && !isMyWin) return false
    }
    return true
  })

  useEffect(() => {
    loadJobs()
    loadStats()
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (jobs.length > 0) loadEscrowData(jobs)
  }, [jobs])

  useEffect(() => {
    if (address) checkMyAgent()
  }, [address])

  useEffect(() => {
    if (leaderboard.length > 0) loadAgentData(leaderboard)
  }, [leaderboard])

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError })
    setTimeout(() => setToast(null), 4000)
  }

  async function getWalletClient() {
    const wallet = wallets.find(w => w.walletClientType !== 'privy')
    if (!wallet) {
      showToast('Connect an external wallet!', true)
      return null
    }
    const provider = await wallet.getEthereumProvider()
    const chainId = await provider.request({ method: 'eth_chainId' })
    if (parseInt(chainId, 16) !== CHAIN_ID) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CHAIN_ID.toString(16) }]
        })
      } catch (e) {
        showToast('Please switch to Base network', true)
        return null
      }
    }
    return createWalletClient({
      chain: base,
      transport: custom(provider),
      account: wallet.address
    })
  }

  async function checkMyAgent() {
    try {
      // Check if user has registered as an agent
      const balance = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: 'balanceOf',
        args: [address]
      })
      if (balance > 0n) {
        // Find their agent ID by checking recent registrations
        const totalAgents = await publicClient.readContract({
          address: CONTRACTS.IDENTITY_REGISTRY,
          abi: IDENTITY_ABI,
          functionName: 'totalAgents'
        })
        // Search backwards for their agent
        for (let i = Number(totalAgents); i >= 1; i--) {
          try {
            const owner = await publicClient.readContract({
              address: CONTRACTS.IDENTITY_REGISTRY,
              abi: IDENTITY_ABI,
              functionName: 'ownerOf',
              args: [BigInt(i)]
            })
            if (owner.toLowerCase() === address.toLowerCase()) {
              setMyAgentId(i)
              break
            }
          } catch (e) { /* token doesn't exist */ }
        }
      }
    } catch (e) {
      console.error('Error checking agent:', e)
    }
  }

  async function loadAgentData(leaderboardData) {
    const data = {}
    for (const entry of leaderboardData) {
      try {
        // Check if wallet has an agent ID
        const balance = await publicClient.readContract({
          address: CONTRACTS.IDENTITY_REGISTRY,
          abi: IDENTITY_ABI,
          functionName: 'balanceOf',
          args: [entry.wallet]
        })
        if (balance > 0n) {
          // Find their agent ID
          const totalAgents = await publicClient.readContract({
            address: CONTRACTS.IDENTITY_REGISTRY,
            abi: IDENTITY_ABI,
            functionName: 'totalAgents'
          })
          for (let i = Number(totalAgents); i >= 1; i--) {
            try {
              const owner = await publicClient.readContract({
                address: CONTRACTS.IDENTITY_REGISTRY,
                abi: IDENTITY_ABI,
                functionName: 'ownerOf',
                args: [BigInt(i)]
              })
              if (owner.toLowerCase() === entry.wallet.toLowerCase()) {
                // Get reputation
                const [score, count] = await publicClient.readContract({
                  address: CONTRACTS.REPUTATION_REGISTRY,
                  abi: REPUTATION_ABI,
                  functionName: 'getReputation',
                  args: [BigInt(i)]
                })
                data[entry.wallet.toLowerCase()] = {
                  agentId: i,
                  reputation: formatReputation(score, count)
                }
                break
              }
            } catch (e) { /* continue */ }
          }
        }
      } catch (e) { /* no agent */ }
    }
    setAgentData(data)
  }

  async function loadEscrowData(jobsList) {
    const data = {}
    for (const job of jobsList) {
      try {
        const result = await publicClient.readContract({
          address: CONTRACTS.ESCROW,
          abi: ESCROW_ABI,
          functionName: 'getJob',
          args: [job.id]
        })
        const [poster, amount, winner, released, refunded] = result
        if (poster !== '0x0000000000000000000000000000000000000000') {
          data[job.id] = { funded: true, amount: formatUnits(amount, 6), winner, released, refunded }
        }
      } catch (e) { /* not funded */ }
    }
    setEscrowData(data)
  }

  async function loadJobs() {
    try {
      const res = await fetch(`${API}/jobs`)
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (e) { console.error('Failed to load jobs', e) }
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API}/stats`)
      setStats(await res.json())
    } catch (e) { console.error('Failed to load stats', e) }
  }

  async function loadLeaderboard() {
    try {
      const res = await fetch(`${API}/leaderboard`)
      const data = await res.json()
      setLeaderboard(data.leaderboard || [])
    } catch (e) { console.error('Failed to load leaderboard', e) }
  }

  async function registerAgent(e) {
    e.preventDefault()
    const walletClient = await getWalletClient()
    if (!walletClient) return

    const name = e.target.name.value.trim()
    const description = e.target.description.value.trim()
    
    setLoading(true)
    try {
      // Create registration JSON
      const registration = {
        type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
        name: name || `Agent ${address.slice(0, 8)}`,
        description: description || 'Nova Jobs Board Worker',
        image: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
        services: [
          { name: 'web', endpoint: 'https://jobs-board-v2.vercel.app' }
        ],
        registrations: [],
        supportedTrust: ['reputation']
      }
      
      // Encode as data URI
      const agentURI = `data:application/json;base64,${btoa(JSON.stringify(registration))}`
      
      showToast('Registering agent...')
      const tx = await walletClient.writeContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: 'register',
        args: [agentURI]
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      
      showToast('Agent registered! 🎉')
      setShowRegisterModal(false)
      checkMyAgent()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Registration failed', true)
    }
    setLoading(false)
  }

  async function giveFeedback(e) {
    e.preventDefault()
    const walletClient = await getWalletClient()
    if (!walletClient || !currentJob) return

    const rating = parseInt(e.target.rating.value)
    const comment = e.target.comment.value.trim()
    
    // Find winner's agent ID
    const winnerWallet = currentJob.winner_wallet
    let winnerAgentId = null
    
    try {
      const totalAgents = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: 'totalAgents'
      })
      for (let i = Number(totalAgents); i >= 1; i--) {
        const owner = await publicClient.readContract({
          address: CONTRACTS.IDENTITY_REGISTRY,
          abi: IDENTITY_ABI,
          functionName: 'ownerOf',
          args: [BigInt(i)]
        })
        if (owner.toLowerCase() === winnerWallet.toLowerCase()) {
          winnerAgentId = i
          break
        }
      }
    } catch (e) { /* not found */ }

    if (!winnerAgentId) {
      showToast('Winner has not registered as an agent yet', true)
      return
    }

    setLoading(true)
    try {
      showToast('Submitting feedback...')
      const tx = await walletClient.writeContract({
        address: CONTRACTS.REPUTATION_REGISTRY,
        abi: REPUTATION_ABI,
        functionName: 'giveFeedback',
        args: [
          BigInt(winnerAgentId),
          BigInt(rating), // value (0-100)
          0, // decimals
          'job-completed', // tag1
          currentJob.id, // tag2 (job ID)
          '', // endpoint
          comment ? `data:text/plain;base64,${btoa(comment)}` : '', // feedbackURI
          '0x0000000000000000000000000000000000000000000000000000000000000000' // feedbackHash
        ]
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      
      showToast('Feedback submitted! ⭐')
      setShowFeedbackModal(false)
      loadLeaderboard()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Feedback failed', true)
    }
    setLoading(false)
  }

  async function fundEscrow(job) {
    const walletClient = await getWalletClient()
    if (!walletClient) return
    
    setLoading(true)
    try {
      const amount = parseUnits(job.reward.toString(), 6)
      const allowance = await publicClient.readContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletClient.account.address, CONTRACTS.ESCROW]
      })
      if (allowance < amount) {
        showToast('Approving USDC...')
        const approveTx = await walletClient.writeContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.ESCROW, amount]
        })
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }
      showToast('Funding escrow...')
      const fundTx = await walletClient.writeContract({
        address: CONTRACTS.ESCROW,
        abi: ESCROW_ABI,
        functionName: 'fundJob',
        args: [job.id, amount]
      })
      await publicClient.waitForTransactionReceipt({ hash: fundTx })
      showToast('Escrow funded! 🔒💰')
      setShowFundModal(false)
      loadJobs()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Transaction failed', true)
    }
    setLoading(false)
  }

  async function releaseFundsOnChain(job) {
    const walletClient = await getWalletClient()
    if (!walletClient) return
    
    setLoading(true)
    try {
      showToast('Releasing funds...')
      const tx = await walletClient.writeContract({
        address: CONTRACTS.ESCROW,
        abi: ESCROW_ABI,
        functionName: 'releaseFunds',
        args: [job.id]
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      
      const tokens = JSON.parse(localStorage.getItem('poster_tokens') || '{}')
      const token = tokens[job.id]
      const markPaidHeaders = { 'Content-Type': 'application/json' }
      if (token) markPaidHeaders['X-Token'] = token
      if (address) markPaidHeaders['X-Wallet'] = address
      await fetch(`${API}/jobs/${job.id}/mark-paid`, {
        method: 'POST',
        headers: markPaidHeaders,
        body: JSON.stringify({ tx_hash: tx })
      })
      showToast('Payment released! 💸')
      setShowPayModal(false)
      
      // Prompt to leave feedback
      setCurrentJob(job)
      setShowFeedbackModal(true)
      
      loadJobs()
      loadStats()
      loadLeaderboard()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Transaction failed', true)
    }
    setLoading(false)
  }

  async function refundEscrow(job) {
    const walletClient = await getWalletClient()
    if (!walletClient) return
    if (!confirm('Refund escrow? This will return USDC to your wallet.')) return
    
    setLoading(true)
    try {
      showToast('Processing refund...')
      const tx = await walletClient.writeContract({
        address: CONTRACTS.ESCROW,
        abi: ESCROW_ABI,
        functionName: 'refundJob',
        args: [job.id]
      })
      await publicClient.waitForTransactionReceipt({ hash: tx })
      showToast('Escrow refunded! 💰')
      loadJobs()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Refund failed', true)
    }
    setLoading(false)
  }

  async function markPaid(e) {
    e.preventDefault()
    if (!currentJob) return
    const tokens = JSON.parse(localStorage.getItem('poster_tokens') || '{}')
    const token = tokens[currentJob.id]
    if (!token && !address) return showToast('Connect wallet or use original device', true)
    const txHash = e.target.tx_hash?.value?.trim() || ''
    
    setLoading(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['X-Token'] = token
      if (address) headers['X-Wallet'] = address
      const res = await fetch(`${API}/jobs/${currentJob.id}/mark-paid`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tx_hash: txHash })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast('Payment marked! 💰')
      setShowPayModal(false)
      
      // Prompt to leave feedback
      setShowFeedbackModal(true)
      
      loadJobs()
      loadStats()
      loadLeaderboard()
    } catch (e) {
      showToast(e.message, true)
    }
    setLoading(false)
  }

  async function postJob(e) {
    e.preventDefault()
    if (!address) return showToast('Connect wallet first!', true)
    const form = e.target
    const title = form.title.value.trim()
    const description = form.description.value.trim()
    const reward = parseFloat(form.reward.value)
    if (!title || !description || !reward) return showToast('Fill all fields!', true)
    if (description.length < 50) return showToast('Description needs 50+ characters', true)
    
    setLoading(true)
    try {
      const res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, reward, currency: 'USDC', poster_wallet: address })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const tokens = JSON.parse(localStorage.getItem('poster_tokens') || '{}')
      tokens[data.id] = data.poster_token
      localStorage.setItem('poster_tokens', JSON.stringify(tokens))
      showToast('Job posted! Fund escrow to secure payment 🔒')
      setShowPostModal(false)
      loadJobs()
      loadStats()
      form.reset()
      setTimeout(() => {
        setCurrentJob({ ...data, reward })
        setShowFundModal(true)
      }, 500)
    } catch (e) {
      showToast(e.message, true)
    }
    setLoading(false)
  }

  async function submitWork(e) {
    e.preventDefault()
    if (!address || !currentJob) return
    const content = e.target.content.value.trim()
    if (!content) return showToast('Enter your work!', true)
    
    setLoading(true)
    try {
      const res = await fetch(`${API}/jobs/${currentJob.id}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, worker_wallet: address })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast('Work submitted! 🚀')
      setShowSubmitModal(false)
      loadJobs()
      e.target.reset()
    } catch (e) {
      showToast(e.message, true)
    }
    setLoading(false)
  }

  async function viewSubmissions(job) {
    setCurrentJob(job)
    try {
      const res = await fetch(`${API}/jobs/${job.id}/submissions`)
      const data = await res.json()
      setSubmissions(data.submissions || [])
      setShowSubsModal(true)
    } catch (e) {
      showToast('Failed to load submissions', true)
    }
  }

  async function selectWinner(subId, workerWallet) {
    const tokens = JSON.parse(localStorage.getItem('poster_tokens') || '{}')
    const token = tokens[currentJob.id]
    // Auth via token OR connected wallet
    if (!token && !address) return showToast('Connect wallet or use original device', true)
    const escrow = escrowData[currentJob.id]
    
    setLoading(true)
    try {
      if (escrow?.funded && !escrow?.released) {
        const walletClient = await getWalletClient()
        if (walletClient) {
          showToast('Selecting winner on-chain...')
          const tx = await walletClient.writeContract({
            address: CONTRACTS.ESCROW,
            abi: ESCROW_ABI,
            functionName: 'selectWinner',
            args: [currentJob.id, workerWallet]
          })
          await publicClient.waitForTransactionReceipt({ hash: tx })
        }
      }
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['X-Token'] = token
      if (address) headers['X-Wallet'] = address
      const res = await fetch(`${API}/jobs/${currentJob.id}/select-winner`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ submission_id: subId })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      showToast('Winner selected! 🏆')
      setShowSubsModal(false)
      loadJobs()
      loadStats()
    } catch (e) {
      console.error(e)
      showToast(e.shortMessage || e.message || 'Failed', true)
    }
    setLoading(false)
  }

  if (!ready) return <div className="app loading">Loading...</div>

  return (
    <div className="app">
      <header>
        <h1>🦐 <span>Nova</span> Jobs Board</h1>
        <p className="subtitle">ERC-8004 Compliant • On-Chain Reputation • Trustless Escrow</p>
      </header>

      <div className="wallet-section">
        {authenticated ? (
          <div className="wallet-connected">
            <span className="wallet-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            {myAgentId ? (
              <span className="agent-badge">🤖 Agent #{myAgentId}</span>
            ) : (
              <button onClick={() => setShowRegisterModal(true)} className="btn btn-agent btn-sm">Register as Agent</button>
            )}
            <button onClick={logout} className="btn btn-secondary">Disconnect</button>
          </div>
        ) : (
          <button onClick={login} className="btn btn-primary">Connect Wallet</button>
        )}
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-val">{stats.open}</div><div className="stat-label">Open</div></div>
        <div className="stat"><div className="stat-val">{stats.completed}</div><div className="stat-label">Done</div></div>
        <div className="stat"><div className="stat-val">${(stats.totalRewards || 0).toFixed(2)}</div><div className="stat-label">Available</div></div>
        <div className="stat"><div className="stat-val">${(stats.totalPaid || 0).toFixed(2)}</div><div className="stat-label">Paid</div></div>
      </div>

      <div className="tabs">
        <button onClick={() => setActiveTab('jobs')} className={`tab ${activeTab === 'jobs' ? 'active' : ''}`}>📋 Jobs</button>
        <button onClick={() => setActiveTab('leaderboard')} className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}>🏆 Leaderboard</button>
      </div>

      <div className="actions">
        {activeTab === 'jobs' && (
          <button onClick={() => authenticated ? setShowPostModal(true) : login()} className="btn btn-primary">+ Post Job</button>
        )}
        <button onClick={() => { loadJobs(); loadStats(); loadLeaderboard(); }} className="btn btn-secondary">↻ Refresh</button>
      </div>

      {activeTab === 'jobs' && (
        <>
          <div className="filters">
            <div className="filter-group">
              <button onClick={() => setFilter('all')} className={`filter-btn ${filter === 'all' ? 'active' : ''}`}>All</button>
              <button onClick={() => setFilter('open')} className={`filter-btn ${filter === 'open' ? 'active' : ''}`}>Open</button>
              <button onClick={() => setFilter('completed')} className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}>Completed</button>
            </div>
            {authenticated && (
              <label className="my-jobs-toggle">
                <input type="checkbox" checked={myJobsOnly} onChange={e => setMyJobsOnly(e.target.checked)} />
                My Activity
              </label>
            )}
          </div>

          <div className="jobs">
            {filteredJobs.length === 0 ? (
              <div className="empty">{jobs.length === 0 ? 'No jobs yet. Post one!' : 'No jobs match your filters.'}</div>
            ) : (
              filteredJobs.map(job => {
                const escrow = escrowData[job.id]
                const isPoster = job.poster_wallet?.toLowerCase() === address?.toLowerCase()
                return (
                  <div key={job.id} className="job">
                    <div className="job-head">
                      <div>
                        <div className="job-title">{job.title}</div>
                        <span className={`badge badge-${job.status}`}>{job.status}</span>
                        {escrow?.funded && !escrow?.released && !escrow?.refunded && <span className="badge badge-escrow">🔒 Escrowed</span>}
                        {escrow?.released && <span className="badge badge-paid">✅ Released</span>}
                        {escrow?.refunded && <span className="badge badge-refunded">↩️ Refunded</span>}
                        {job.status === 'completed' && !escrow?.funded && (
                          <span className={`badge badge-${job.payment_status === 'paid' ? 'paid' : 'unpaid'}`}>
                            {job.payment_status === 'paid' ? '💰 Paid' : '⏳ Unpaid'}
                          </span>
                        )}
                      </div>
                      <div className="job-reward">{job.reward} {job.currency}</div>
                    </div>
                    <div className="job-desc">{job.description}</div>
                    <div className="job-meta">
                      <span>📅 {new Date(job.created_at).toLocaleDateString()}</span>
                      <span>👤 {job.poster_wallet?.slice(0, 8)}...</span>
                      <span>📤 {job.submission_count || 0}</span>
                      {job.winner_wallet && <span>🏆 {job.winner_wallet?.slice(0, 8)}...</span>}
                    </div>
                    <div className="job-actions">
                      {job.status === 'open' && !isPoster && (
                        <button onClick={() => authenticated ? (setCurrentJob(job), setShowSubmitModal(true)) : login()} className="btn btn-primary btn-sm">Submit Work</button>
                      )}
                      <button onClick={() => viewSubmissions(job)} className="btn btn-secondary btn-sm">View Submissions</button>
                      {isPoster && job.status === 'open' && !escrow?.funded && (
                        <button onClick={() => { setCurrentJob(job); setShowFundModal(true) }} className="btn btn-escrow btn-sm">🔒 Fund Escrow</button>
                      )}
                      {isPoster && job.status === 'open' && escrow?.funded && !job.winner_wallet && (
                        <button onClick={() => refundEscrow(job)} className="btn btn-secondary btn-sm" disabled={loading}>↩️ Refund</button>
                      )}
                      {isPoster && job.status === 'completed' && escrow?.funded && !escrow?.released && (
                        <button onClick={() => releaseFundsOnChain(job)} className="btn btn-success btn-sm" disabled={loading}>💸 Release Funds</button>
                      )}
                      {isPoster && job.status === 'completed' && !escrow?.funded && job.payment_status !== 'paid' && (
                        <button onClick={() => { setCurrentJob(job); setShowPayModal(true) }} className="btn btn-success btn-sm">💳 Mark Paid</button>
                      )}
                      {isPoster && job.status === 'completed' && (job.payment_status === 'paid' || escrow?.released) && (
                        <button onClick={() => { setCurrentJob(job); setShowFeedbackModal(true) }} className="btn btn-feedback btn-sm">⭐ Leave Feedback</button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'leaderboard' && (
        <div className="leaderboard">
          <div className="leaderboard-header">
            <span>Rank</span>
            <span>Worker</span>
            <span>Jobs</span>
            <span>Earned</span>
            <span>Reputation</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="empty">No workers yet. Complete a job to join!</div>
          ) : (
            leaderboard.map(entry => {
              const agent = agentData[entry.wallet?.toLowerCase()]
              return (
                <div key={entry.wallet} className={`leaderboard-row ${entry.wallet?.toLowerCase() === address?.toLowerCase() ? 'highlight' : ''}`}>
                  <span className="rank">#{entry.rank}</span>
                  <span className="wallet">
                    {entry.wallet?.slice(0, 8)}...{entry.wallet?.slice(-4)}
                    {agent && <span className="agent-id">🤖#{agent.agentId}</span>}
                  </span>
                  <span className="jobs-count">{entry.completed}</span>
                  <span className="earned">${entry.earned.toFixed(2)}</span>
                  <span className="reputation">
                    {agent ? (
                      <span className="rep-score">{agent.reputation.display}</span>
                    ) : (
                      <span className="no-agent">Not registered</span>
                    )}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Agent Registration Modal */}
      {showRegisterModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowRegisterModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowRegisterModal(false)}>✕</button>
            <h2>🤖 Register as Agent</h2>
            <p className="modal-subtitle">Create your ERC-8004 compliant agent identity</p>
            <form onSubmit={registerAgent}>
              <div className="field"><label>Agent Name (optional)</label><input name="name" placeholder={`Agent ${address?.slice(0, 8)}`} /></div>
              <div className="field"><label>Description (optional)</label><textarea name="description" placeholder="Tell people about yourself..." /></div>
              <p className="help-text">Your agent identity is an NFT that tracks your on-chain reputation across the ecosystem.</p>
              <div className="modal-btns">
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-agent" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && currentJob && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowFeedbackModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowFeedbackModal(false)}>✕</button>
            <h2>⭐ Leave Feedback</h2>
            <p className="modal-subtitle">Rate the worker for: {currentJob.title}</p>
            <form onSubmit={giveFeedback}>
              <div className="field">
                <label>Rating (0-100)</label>
                <input name="rating" type="number" min="0" max="100" defaultValue="80" required />
              </div>
              <div className="field">
                <label>Comment (optional)</label>
                <textarea name="comment" placeholder="How was the work?" />
              </div>
              <p className="help-text">Feedback is stored on-chain and contributes to the worker's reputation score.</p>
              <div className="modal-btns">
                <button type="button" onClick={() => setShowFeedbackModal(false)} className="btn btn-secondary">Skip</button>
                <button type="submit" className="btn btn-feedback" disabled={loading}>{loading ? 'Submitting...' : 'Submit Feedback'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Job Modal */}
      {showPostModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowPostModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowPostModal(false)}>✕</button>
            <h2>📝 Post a Job</h2>
            <form onSubmit={postJob}>
              <div className="field"><label>Title</label><input name="title" placeholder="What do you need?" required /></div>
              <div className="field"><label>Description (50+ chars)</label><textarea name="description" placeholder="Details..." required /></div>
              <div className="field"><label>Reward (USDC)</label><input name="reward" type="number" step="0.01" placeholder="5" required /></div>
              <p className="help-text">After posting, fund an escrow to secure payment on-chain.</p>
              <div className="modal-btns">
                <button type="button" onClick={() => setShowPostModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Posting...' : 'Post'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fund Escrow Modal */}
      {showFundModal && currentJob && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowFundModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowFundModal(false)}>✕</button>
            <h2>🔒 Fund Escrow</h2>
            <p className="modal-subtitle">{currentJob.title}</p>
            <div className="escrow-details">
              <p><strong>Amount:</strong> {currentJob.reward} USDC</p>
              <p><strong>Platform fee:</strong> 2% (on release)</p>
              <p><strong>Winner receives:</strong> {(currentJob.reward * 0.98).toFixed(2)} USDC</p>
            </div>
            <p className="help-text">USDC held in escrow until you select a winner and release funds.</p>
            <div className="modal-btns">
              <button onClick={() => setShowFundModal(false)} className="btn btn-secondary">Later</button>
              <button onClick={() => fundEscrow(currentJob)} className="btn btn-escrow" disabled={loading}>
                {loading ? 'Processing...' : `Fund ${currentJob.reward} USDC`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Work Modal */}
      {showSubmitModal && currentJob && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowSubmitModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowSubmitModal(false)}>✕</button>
            <h2>📤 Submit Work</h2>
            <p className="modal-subtitle">{currentJob.title}</p>
            {escrowData[currentJob.id]?.funded && <p className="escrow-badge">🔒 {currentJob.reward} USDC in escrow</p>}
            {!myAgentId && (
              <p className="warning-badge">⚠️ Register as an agent to build reputation!</p>
            )}
            <form onSubmit={submitWork}>
              <div className="field"><label>Your Work</label><textarea name="content" placeholder="Your deliverable..." required /></div>
              <div className="modal-btns">
                <button type="button" onClick={() => setShowSubmitModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submissions Modal */}
      {showSubsModal && currentJob && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowSubsModal(false)}>
          <div className="modal modal-wide">
            <button className="modal-close" onClick={() => setShowSubsModal(false)}>✕</button>
            <h2>📥 Submissions</h2>
            <p className="modal-subtitle">{currentJob.title}</p>
            {escrowData[currentJob.id]?.funded && <p className="escrow-badge">🔒 {currentJob.reward} USDC in escrow</p>}
            <div className="subs-list">
              {submissions.length === 0 ? (
                <div className="empty-small">No submissions yet.</div>
              ) : (
                submissions.map(sub => {
                  const subAgent = agentData[sub.worker_wallet?.toLowerCase()]
                  return (
                    <div key={sub.id} className="submission">
                      <div className="sub-head">
                        <span>
                          👤 {sub.worker_wallet?.slice(0, 10)}...
                          {subAgent && <span className="agent-id">🤖#{subAgent.agentId} ({subAgent.reputation.display})</span>}
                        </span>
                        <span>{new Date(sub.created_at).toLocaleString()}</span>
                      </div>
                      <div className="sub-content">{sub.content}</div>
                      {currentJob.poster_wallet?.toLowerCase() === address?.toLowerCase() && sub.status !== 'winner' && currentJob.status === 'open' && (
                        <button onClick={() => selectWinner(sub.id, sub.worker_wallet)} className="btn btn-primary btn-sm" style={{marginTop: '10px'}} disabled={loading}>
                          ✓ Select Winner
                        </button>
                      )}
                      {sub.status === 'winner' && <div className="winner-badge">🏆 Winner</div>}
                    </div>
                  )
                })
              )}
            </div>
            <div className="modal-btns sticky">
              <button onClick={() => setShowSubsModal(false)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && currentJob && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowPayModal(false)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowPayModal(false)}>✕</button>
            <h2>💳 Mark as Paid</h2>
            <p className="modal-subtitle">{currentJob.title}</p>
            <div className="pay-details">
              <p><strong>Winner:</strong> {currentJob.winner_wallet?.slice(0, 12)}...</p>
              <p><strong>Amount:</strong> {currentJob.reward} {currentJob.currency}</p>
            </div>
            <form onSubmit={markPaid}>
              <div className="field">
                <label>Transaction Hash (optional)</label>
                <input name="tx_hash" placeholder="0x..." />
              </div>
              <p className="help-text">
                Send {currentJob.reward} {currentJob.currency} to:<br/>
                <code className="wallet-code">{currentJob.winner_wallet}</code>
              </p>
              <div className="modal-btns">
                <button type="button" onClick={() => setShowPayModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-success" disabled={loading}>{loading ? 'Marking...' : 'Confirm Paid'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.isError ? 'error' : ''}`}>{toast.msg}</div>}
    </div>
  )
}

export default App
