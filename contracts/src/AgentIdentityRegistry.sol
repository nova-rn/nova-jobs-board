// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

/**
 * @title AgentIdentityRegistry
 * @notice ERC-8004 compliant Identity Registry for Nova Jobs Board
 * @dev ERC-721 based agent registration with metadata and wallet verification
 */
contract AgentIdentityRegistry is ERC721URIStorage, EIP712 {
    using ECDSA for bytes32;

    uint256 private _nextAgentId = 1;
    
    // agentId => metadataKey => metadataValue
    mapping(uint256 => mapping(string => bytes)) private _metadata;
    
    // agentId => verified wallet address
    mapping(uint256 => address) private _agentWallets;

    // EIP-712 typehash for wallet verification
    bytes32 public constant WALLET_TYPEHASH = keccak256(
        "SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)"
    );

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue);
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet);
    event AgentWalletUnset(uint256 indexed agentId);

    constructor() ERC721("Nova Agent Registry", "AGENT") EIP712("NovaAgentRegistry", "1") {}

    /**
     * @notice Register a new agent
     * @param agentURI URI pointing to agent registration file
     * @return agentId The newly minted agent ID
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        
        // Set default agent wallet to owner
        _agentWallets[agentId] = msg.sender;
        
        emit Registered(agentId, agentURI, msg.sender);
        emit AgentWalletSet(agentId, msg.sender);
    }

    /**
     * @notice Register without URI (set later)
     */
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _agentWallets[agentId] = msg.sender;
        
        emit Registered(agentId, "", msg.sender);
        emit AgentWalletSet(agentId, msg.sender);
    }

    /**
     * @notice Update agent URI
     * @param agentId The agent to update
     * @param newURI New URI for agent registration file
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Get metadata for an agent
     * @param agentId The agent ID
     * @param metadataKey The metadata key
     * @return The metadata value
     */
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice Set metadata for an agent
     * @param agentId The agent ID
     * @param metadataKey The metadata key
     * @param metadataValue The metadata value
     */
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        require(keccak256(bytes(metadataKey)) != keccak256(bytes("agentWallet")), "Use setAgentWallet");
        
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /**
     * @notice Get the verified wallet for an agent
     * @param agentId The agent ID
     * @return The agent's verified wallet address
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _agentWallets[agentId];
    }

    /**
     * @notice Set agent wallet with signature verification
     * @param agentId The agent ID
     * @param newWallet The new wallet address
     * @param deadline Signature expiry timestamp
     * @param signature EIP-712 signature from newWallet
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Invalid wallet");

        bytes32 structHash = keccak256(abi.encode(WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 hash = _hashTypedDataV4(structHash);

        // Try EOA signature first
        address signer = hash.recover(signature);
        if (signer != newWallet) {
            // Try ERC-1271 smart contract signature
            try IERC1271(newWallet).isValidSignature(hash, signature) returns (bytes4 magicValue) {
                require(magicValue == IERC1271.isValidSignature.selector, "Invalid signature");
            } catch {
                revert("Invalid signature");
            }
        }

        _agentWallets[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    /**
     * @notice Unset the agent wallet
     * @param agentId The agent ID
     */
    function unsetAgentWallet(uint256 agentId) external {
        require(_isApprovedOrOwner(msg.sender, agentId), "Not authorized");
        delete _agentWallets[agentId];
        emit AgentWalletUnset(agentId);
    }

    /**
     * @notice Get total number of registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    /**
     * @dev Clear agent wallet on transfer
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        
        // Clear wallet on transfer (not on mint)
        if (from != address(0) && to != address(0)) {
            delete _agentWallets[tokenId];
            emit AgentWalletUnset(tokenId);
        }
        
        return from;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }
}
