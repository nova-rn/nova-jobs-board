// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title JobEscrow
 * @notice Escrow contract for Nova Jobs Board - holds USDC until job completion
 * @dev Deployed on Base mainnet
 */
contract JobEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Base Mainnet USDC
    IERC20 public immutable usdc;
    
    // Platform fee (basis points, 100 = 1%)
    uint256 public platformFeeBps = 200; // 2%
    address public feeRecipient;
    address public owner;

    struct Job {
        string jobId;           // Off-chain job ID
        address poster;         // Who posted the job
        uint256 amount;         // USDC amount (6 decimals)
        address winner;         // Selected winner
        bool released;          // Funds released
        bool refunded;          // Funds refunded
        uint256 createdAt;
    }

    // jobId => Job
    mapping(string => Job) public jobs;
    
    // Track all job IDs
    string[] public jobIds;

    // Events
    event JobFunded(string indexed jobId, address indexed poster, uint256 amount);
    event WinnerSelected(string indexed jobId, address indexed winner);
    event FundsReleased(string indexed jobId, address indexed winner, uint256 amount, uint256 fee);
    event FundsRefunded(string indexed jobId, address indexed poster, uint256 amount);
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyPoster(string calldata jobId) {
        require(jobs[jobId].poster == msg.sender, "Not poster");
        _;
    }

    constructor(address _usdc, address _feeRecipient) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        owner = msg.sender;
    }

    /**
     * @notice Fund a new job escrow
     * @param jobId Unique job identifier from off-chain system
     * @param amount USDC amount (6 decimals)
     */
    function fundJob(string calldata jobId, uint256 amount) external nonReentrant {
        require(bytes(jobId).length > 0, "Invalid job ID");
        require(amount > 0, "Amount must be > 0");
        require(jobs[jobId].poster == address(0), "Job already exists");

        // Transfer USDC from poster to contract
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Create job
        jobs[jobId] = Job({
            jobId: jobId,
            poster: msg.sender,
            amount: amount,
            winner: address(0),
            released: false,
            refunded: false,
            createdAt: block.timestamp
        });

        jobIds.push(jobId);

        emit JobFunded(jobId, msg.sender, amount);
    }

    /**
     * @notice Select winner for a job (poster only)
     * @param jobId Job identifier
     * @param winner Winner's address
     */
    function selectWinner(string calldata jobId, address winner) external onlyPoster(jobId) {
        Job storage job = jobs[jobId];
        require(!job.released && !job.refunded, "Job already finalized");
        require(winner != address(0), "Invalid winner");
        require(winner != job.poster, "Winner cannot be poster");

        job.winner = winner;

        emit WinnerSelected(jobId, winner);
    }

    /**
     * @notice Release funds to winner (poster only)
     * @param jobId Job identifier
     */
    function releaseFunds(string calldata jobId) external onlyPoster(jobId) nonReentrant {
        Job storage job = jobs[jobId];
        require(job.winner != address(0), "No winner selected");
        require(!job.released && !job.refunded, "Job already finalized");

        job.released = true;

        // Calculate fee
        uint256 fee = (job.amount * platformFeeBps) / 10000;
        uint256 winnerAmount = job.amount - fee;

        // Transfer to winner
        usdc.safeTransfer(job.winner, winnerAmount);
        
        // Transfer fee
        if (fee > 0) {
            usdc.safeTransfer(feeRecipient, fee);
        }

        emit FundsReleased(jobId, job.winner, winnerAmount, fee);
    }

    /**
     * @notice Refund funds to poster (poster only, no winner selected)
     * @param jobId Job identifier
     */
    function refundJob(string calldata jobId) external onlyPoster(jobId) nonReentrant {
        Job storage job = jobs[jobId];
        require(job.winner == address(0), "Winner already selected");
        require(!job.released && !job.refunded, "Job already finalized");

        job.refunded = true;

        // Return full amount to poster
        usdc.safeTransfer(job.poster, job.amount);

        emit FundsRefunded(jobId, job.poster, job.amount);
    }

    /**
     * @notice Get job details
     */
    function getJob(string calldata jobId) external view returns (
        address poster,
        uint256 amount,
        address winner,
        bool released,
        bool refunded,
        uint256 createdAt
    ) {
        Job storage job = jobs[jobId];
        return (job.poster, job.amount, job.winner, job.released, job.refunded, job.createdAt);
    }

    /**
     * @notice Get total number of jobs
     */
    function totalJobs() external view returns (uint256) {
        return jobIds.length;
    }

    // Admin functions
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
