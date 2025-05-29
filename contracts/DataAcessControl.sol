// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataAccessControl {
    mapping(address => string) private dataHashes;
    mapping(address => address[]) private accessList;
    mapping(address => mapping(address => bool)) private hasAccess;

    function updateDataHash(string memory ipfsHash) public {
        dataHashes[msg.sender] = ipfsHash;
    }

    function getMyDataHash() public view returns (string memory) {
        return dataHashes[msg.sender];
    }

    function grantAccess(address doctor) public {
        if (!hasAccess[msg.sender][doctor]) {
            accessList[doctor].push(msg.sender);
            hasAccess[msg.sender][doctor] = true;
        }
    }

    function getAccessiblePatients() public view returns (address[] memory) {
        return accessList[msg.sender];
    }

    function getPatientDataHash(address patient) public view returns (string memory) {
        require(hasAccess[patient][msg.sender], "No access to this patient's data");
        return dataHashes[patient];
    }
}