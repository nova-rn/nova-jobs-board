// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ReputationRegistry
 * @notice ERC-8004 compliant Reputation Registry for Nova Jobs Board
 * @dev Stores and indexes feedback signals for agents
 */
contract ReputationRegistry {
    
    address public identityRegistry;
    address public owner;

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
        uint64 timestamp;
    }

    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) public feedbacks;
    
    // agentId => clientAddress => feedbackCount
    mapping(uint256 => mapping(address => uint64)) public feedbackCounts;
    
    // agentId => total feedback count
    mapping(uint256 => uint256) public totalFeedbackCount;
    
    // agentId => aggregated score (sum of non-revoked values * 10^18 / count)
    mapping(uint256 => int256) public aggregatedScores;
    mapping(uint256 => uint256) public activeScoreCount;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex
    );

    event IdentityRegistrySet(address indexed newRegistry);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "Invalid registry");
        identityRegistry = _identityRegistry;
        owner = msg.sender;
        emit IdentityRegistrySet(_identityRegistry);
    }

    /**
     * @notice Get the identity registry address
     */
    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    /**
     * @notice Give feedback to an agent
     * @param agentId The agent receiving feedback
     * @param value Feedback value (signed fixed-point)
     * @param valueDecimals Decimal places for value (0-18)
     * @param tag1 Optional tag for categorization
     * @param tag2 Optional secondary tag
     * @param endpoint Optional endpoint being rated
     * @param feedbackURI Optional URI to off-chain feedback file
     * @param feedbackHash Optional KECCAK-256 hash of feedback file
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(valueDecimals <= 18, "Invalid decimals");
        
        // Verify agent exists
        address agentOwner = IERC721(identityRegistry).ownerOf(agentId);
        require(agentOwner != address(0), "Agent does not exist");
        
        // Feedback submitter must not be agent owner or approved operator
        require(msg.sender != agentOwner, "Cannot rate own agent");
        require(!IERC721(identityRegistry).isApprovedForAll(agentOwner, msg.sender), "Operators cannot rate");
        
        // Increment feedback index (1-indexed)
        uint64 feedbackIndex = ++feedbackCounts[agentId][msg.sender];
        
        // Store feedback
        feedbacks[agentId][msg.sender][feedbackIndex] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            isRevoked: false,
            timestamp: uint64(block.timestamp)
        });
        
        // Update aggregations
        totalFeedbackCount[agentId]++;
        _updateAggregatedScore(agentId, value, valueDecimals, true);
        
        emit NewFeedback(
            agentId,
            msg.sender,
            feedbackIndex,
            value,
            valueDecimals,
            tag1,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent ID
     * @param feedbackIndex The feedback index to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage fb = feedbacks[agentId][msg.sender][feedbackIndex];
        require(fb.timestamp > 0, "Feedback does not exist");
        require(!fb.isRevoked, "Already revoked");
        
        fb.isRevoked = true;
        
        // Update aggregations
        _updateAggregatedScore(agentId, fb.value, fb.valueDecimals, false);
        
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Get feedback details
     * @param agentId The agent ID
     * @param clientAddress The client who gave feedback
     * @param feedbackIndex The feedback index
     */
    function getFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    ) external view returns (
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        bool isRevoked,
        uint64 timestamp
    ) {
        Feedback storage fb = feedbacks[agentId][clientAddress][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked, fb.timestamp);
    }

    /**
     * @notice Get aggregated reputation score for an agent
     * @param agentId The agent ID
     * @return score Average score (scaled by 1e18)
     * @return count Number of active (non-revoked) feedbacks
     */
    function getReputation(uint256 agentId) external view returns (int256 score, uint256 count) {
        count = activeScoreCount[agentId];
        if (count == 0) {
            return (0, 0);
        }
        score = aggregatedScores[agentId] / int256(count);
    }

    /**
     * @dev Update aggregated score
     */
    function _updateAggregatedScore(uint256 agentId, int128 value, uint8 decimals, bool isAdd) internal {
        // Normalize to 18 decimals
        int256 normalizedValue = int256(value) * int256(10 ** (18 - decimals));
        
        if (isAdd) {
            aggregatedScores[agentId] += normalizedValue;
            activeScoreCount[agentId]++;
        } else {
            aggregatedScores[agentId] -= normalizedValue;
            activeScoreCount[agentId]--;
        }
    }

    /**
     * @notice Update identity registry (owner only)
     */
    function setIdentityRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Invalid registry");
        identityRegistry = newRegistry;
        emit IdentityRegistrySet(newRegistry);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
