// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external;
}

abstract contract ReentrancyGuard {
    uint256 private _status;
    constructor() { _status = 1; }
    modifier nonReentrant() {
        require(_status == 1, "REENTRANCY");
        _status = 2;
        _;
        _status = 1;
    }
}

abstract contract Ownable {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    address public owner;
    modifier onlyOwner() { require(msg.sender == owner, "ONLY_OWNER"); _; }
    constructor() { owner = msg.sender; emit OwnershipTransferred(address(0), msg.sender); }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ZERO_ADDR");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

abstract contract Pausable is Ownable {
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    bool public paused;
    modifier whenNotPaused() { require(!paused, "PAUSED"); _; }
    function pause() external onlyOwner { paused = true; emit Paused(msg.sender); }
    function unpause() external onlyOwner { paused = false; emit Unpaused(msg.sender); }
}

/// @title USDT Transfer Gateway
contract UsdtGateway is ReentrancyGuard, Pausable {
    error ZeroAddress();
    error InsufficientAllowance(uint256 required, uint256 current);
    error ERC20TransferFailed();
    error FeeForwardFailed();
    error InsufficientFee(uint256 required, uint256 sent);

    event DefaultFeeUpdated(uint256 newFeeWei);
    event FeeRecipientUpdated(address indexed newRecipient);
    event CustomFeeSet(address indexed wallet, uint256 feeWei);
    event CustomFeeCleared(address indexed wallet);
    event TransferWithFee(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 requiredFeeWei,
        uint256 sentFeeWei,
        address indexed feeRecipient
    );

    IERC20 public immutable usdt;
    address public feeRecipient;

    // Default fee (wei) when no custom fee is set for msg.sender
    uint256 public defaultFeeWei;

    // Per-wallet fee override
    mapping(address => uint256) private _customFeeWei;
    mapping(address => bool)    private _hasCustomFee; // distinguishes 0 override vs "no override"

    constructor(address usdtToken, address feeRecipient_, uint256 defaultFeeWei_) {
        if (usdtToken == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        usdt = IERC20(usdtToken);
        feeRecipient = feeRecipient_;
        defaultFeeWei = defaultFeeWei_;
    }

    // -------- Owner controls --------
    function setDefaultFee(uint256 newFeeWei) external onlyOwner {
        defaultFeeWei = newFeeWei;
        emit DefaultFeeUpdated(newFeeWei);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /// @notice Set a custom fee for one wallet (including zero for fee-exempt)
    function setFeeFor(address wallet, uint256 feeWei_) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        _customFeeWei[wallet] = feeWei_;
        _hasCustomFee[wallet] = true;
        emit CustomFeeSet(wallet, feeWei_);
    }

    /// @notice Clear custom fee so wallet falls back to default
    function clearFeeFor(address wallet) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        delete _customFeeWei[wallet];
        delete _hasCustomFee[wallet];
        emit CustomFeeCleared(wallet);
    }

    /// @notice Batch set custom fees
    function setFeesFor(address[] calldata wallets, uint256[] calldata feesWei) external onlyOwner {
        require(wallets.length == feesWei.length, "LENGTH_MISMATCH");
        for (uint256 i = 0; i < wallets.length; i++) {
            address w = wallets[i];
            if (w == address(0)) revert ZeroAddress();
            _customFeeWei[w] = feesWei[i];
            _hasCustomFee[w] = true;
            emit CustomFeeSet(w, feesWei[i]);
        }
    }

    // -------- Views --------
    function hasCustomFee(address wallet) external view returns (bool) {
        return _hasCustomFee[wallet];
    }

    function customFeeOf(address wallet) external view returns (uint256) {
        return _customFeeWei[wallet];
    }

    /// @notice Effective required fee (wei) for a given wallet (custom or default)
    function effectiveFeeOf(address wallet) public view returns (uint256) {
        return _hasCustomFee[wallet] ? _customFeeWei[wallet] : defaultFeeWei;
    }

    // -------- Main user functions --------

    /// @notice Pay required fee (if any), then transfer USDT from sender to recipient
    /// @dev Requires prior approval: usdt.approve(address(this), amount)
    function sendUSDT(address recipient, uint256 amount)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        _collectAndForwardFee(msg.sender);
        _transferUSDT(msg.sender, recipient, amount);
    }

    /// @notice Single-tx path via EIP-2612 permit (if USDT supports it)
    function sendUSDTWithPermit(
        address recipient,
        uint256 amount,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external payable whenNotPaused nonReentrant {
        _collectAndForwardFee(msg.sender);

        IERC20Permit(address(usdt)).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v, r, s
        );

        _transferUSDT(msg.sender, recipient, amount);
    }

    // -------- Internals --------
    function _collectAndForwardFee(address from) internal {
        uint256 required = effectiveFeeOf(from);
        if (msg.value < required) revert InsufficientFee(required, msg.value);

        // Forward ALL msg.value to feeRecipient (no refunds by design)
        (bool ok, ) = feeRecipient.call{value: msg.value}("");
        if (!ok) revert FeeForwardFailed();
    }

    function _transferUSDT(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();

        uint256 currentAllowance = usdt.allowance(from, address(this));
        if (currentAllowance < amount) revert InsufficientAllowance(amount, currentAllowance);

        bool ok = usdt.transferFrom(from, to, amount);
        if (!ok) revert ERC20TransferFailed();

        emit TransferWithFee(from, to, amount, effectiveFeeOf(from), msg.value, feeRecipient);
    }

    receive() external payable {}
}