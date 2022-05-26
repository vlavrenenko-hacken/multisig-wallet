// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title A contract for MultisigWallet
/// @author Lavrenenko V.V.
/// @notice You can use this contract for daily multisignature transactions
/// @dev All function calls are currently implemented without side effects
contract MultiSigWallet {
    /// @dev Emitted when a deposit is made
    event Deposit(address indexed sender, uint amount, uint balance);
    
    /// @dev Emitted when a transaction is submitted
    event SubmitTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed to,
        uint value,
        bytes data
    );

    /// @dev Emitted when a transaction is confirmed
    event ConfirmTransaction(address indexed owner, uint indexed txIndex);
    
    /// @dev Emitted when a confirmation is revoked
    event RevokeConfirmation(address indexed owner, uint indexed txIndex);
    
    /// @dev Emitted when a transaction is executed
    event ExecuteTransaction(address indexed owner, uint indexed txIndex);

    /// @dev Emitted when a transaction is changed
    event ChangeTransaction(
        address indexed owner,
        uint indexed txIndex,
        address indexed _to,
        uint _value,
        bytes _data
    );

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint public numConfirmationsRequired;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    /// @dev mapping txIndex to (owner => bool)
    mapping(uint => mapping(address => bool)) public isConfirmed;

    Transaction[] public transactions;

    /// @dev Checks whether a sender is the owner or not
    modifier onlyOwners() {
        require(isOwner[msg.sender], "not owner");
        _;
    }

    /// @dev Checks whether the index of a transaction exists or not
    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    /// @dev Checks whether a transaction was executed or not
    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    /// @dev Checks whether a transaction was confirmed or not
    modifier notConfirmed(uint _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "tx already confirmed");
        _;
    }

    /// @dev Sets the values for {owners} and {numComfirmationsRequired}
    constructor(address[] memory _owners, uint _numConfirmationsRequired) {
        require(_owners.length > 0, "owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= _owners.length,
            "invalid number of required confirmations"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "invalid owner");
            require(!isOwner[owner], "owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /// @dev Allows the contract to receive funds and emits Deposit after funds were transfered to the contract address
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /// @notice Submits a transaction
    /// @dev The Lavrenenko V.V. Emits the event SubmitTransaction
    /// @param _to A recipient's address
    /// @param _value A number of tokens to be transfered
    /// @param _data Data to be transfered
    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data
    ) public onlyOwners isValidData(_to, _value, _data) {
        uint txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /// @notice Confirms a transaction
    /// @dev The Lavrenenko V.V. Emits the event ConfirmTransaction
    /// @param _txIndex The index of a transaction
    function confirmTransaction(uint _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /// @notice Executes a transaction
    /// @dev The Lavrenenko V.V. Emits the event ExecuteTransaction
    /// @param _txIndex The index of a transaction
    function executeTransaction(uint _txIndex)
        public
        onlyOwners
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /// @notice Changes a transaction
    /// @dev The Lavrenenko V.V. Emits the event ChangeTransaction
    /// @param _txIndex The index of the transaction
    /// @param _to The address of the recipieint of the transaction
    /// @param _value The value will be transfered in the transaction
    /// @param _data The data will be transefered in the transactioon
      function changeTransaction(uint _txIndex, address _to, uint _value, bytes memory _data)
        public
        onlyOwners
        txExists(_txIndex)
        notExecuted(_txIndex)
        isValidData(_to, _value, _data)
    {   
        Transaction storage transaction = transactions[_txIndex];

        transaction.to = _to;
        transaction.value = _value;
        transaction.data = _data;
        transaction.numConfirmations = 0;
        
        emit ChangeTransaction(msg.sender, _txIndex, _to, _value, _data);
    }
    
    /// @notice Revokes Confirmation
    /// @dev The Lavrenenko V.V. Emits the event RevokeConfirmation
    /// @param _txIndex The index of a transaction
    function revokeConfirmation(uint _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /// @notice Returns the approved addresses of the wallet
    /// @return The approved addresses of the wallet as an address[] memory array
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    /// @notice Returns the number of transactions
    /// @return The length of the transactions array as an uint256 value
    function getTransactionCount() public view returns (uint) {
        return transactions.length;
    }

    /// @notice Returns a transaction by its index
    /// @param _txIndex The index of the transaction
    /// @return to The recipient of the transaction
    /// @return value Amount of funds were transfered
    /// @return data
    /// @return executed The transaction was executed or not
    /// @return numConfirmations The number of times owners confirmed the transaction
    function getTransaction(uint _txIndex)
        public
        view
        returns (
            address to,
            uint value,
            bytes memory data,
            bool executed,
            uint numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}