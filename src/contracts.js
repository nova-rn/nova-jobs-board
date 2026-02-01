// ERC-8004 Compliant Contract Addresses - Base Mainnet

export const CONTRACTS = {
  IDENTITY_REGISTRY: '0x12D7D4F119CFd35Cb3b5308af3F3f23272447de8',
  REPUTATION_REGISTRY: '0x4e3Ed4e4B98A54c9641EB92aAaf87843388f50d1',
  ESCROW: '0xD43650250cEDDAF79FF72F44d28e3082F72420Ab',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}

export const CHAIN_ID = 8453 // Base Mainnet

// Agent Identity Registry ABI (ERC-8004)
export const IDENTITY_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'register',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setAgentURI',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'totalAgents',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' }
    ],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true }
    ]
  }
]

// Reputation Registry ABI (ERC-8004)
export const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'giveFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'revokeFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'feedbackIndex', type: 'uint64' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getReputation',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'score', type: 'int256' },
      { name: 'count', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' }
    ],
    outputs: [
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'isRevoked', type: 'bool' },
      { name: 'timestamp', type: 'uint64' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'feedbackCounts',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint64' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'totalFeedbackCount',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'NewFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'clientAddress', type: 'address', indexed: true },
      { name: 'feedbackIndex', type: 'uint64', indexed: false },
      { name: 'value', type: 'int128', indexed: false },
      { name: 'valueDecimals', type: 'uint8', indexed: false },
      { name: 'indexedTag1', type: 'string', indexed: true },
      { name: 'tag1', type: 'string', indexed: false },
      { name: 'tag2', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
      { name: 'feedbackURI', type: 'string', indexed: false },
      { name: 'feedbackHash', type: 'bytes32', indexed: false }
    ]
  }
]

// Job Escrow ABI
export const ESCROW_ABI = [
  {
    type: 'function',
    name: 'fundJob',
    inputs: [
      { name: 'jobId', type: 'string' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'selectWinner',
    inputs: [
      { name: 'jobId', type: 'string' },
      { name: 'winner', type: 'address' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'releaseFunds',
    inputs: [{ name: 'jobId', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'refundJob',
    inputs: [{ name: 'jobId', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getJob',
    inputs: [{ name: 'jobId', type: 'string' }],
    outputs: [
      { name: 'poster', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'winner', type: 'address' },
      { name: 'released', type: 'bool' },
      { name: 'refunded', type: 'bool' },
      { name: 'createdAt', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'platformFeeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
]

// ERC-20 ABI (for USDC)
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  }
]

// Helper to format reputation score
export function formatReputation(score, count) {
  if (count === 0n) return { score: 0, count: 0, display: 'No ratings' }
  // Score is scaled by 1e18, normalize to 0-100
  const normalized = Number(score) / 1e18
  return {
    score: normalized,
    count: Number(count),
    display: `${normalized.toFixed(1)}/100 (${count} ${count === 1n ? 'rating' : 'ratings'})`
  }
}
