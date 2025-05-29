// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PatientRegistry {
    mapping(address => string) public patientIds;

    function registerPatient(string memory patientId) public {
        patientIds[msg.sender] = patientId;
    }

    function getPatientId(address patient) public view returns (string memory) {
        return patientIds[patient];
    }
}