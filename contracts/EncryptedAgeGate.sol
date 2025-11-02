// Updated: 2025-11-05 10:36:15
// Updated: 2025-11-04 10:20:29
// Updated: 2025-11-06 11:35:14
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;



import {FHE, ebool, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";



/// @title EncryptedAgeGate
/// @notice Performs encrypted age verification (>= 18) and tracks encrypted stats.
contract EncryptedAgeGate is SepoliaConfig {
    uint8 public constant MINIMUM_ADULT_AGE = 18;



    mapping(address => euint8) private _latestEncryptedAge;
    mapping(address => ebool) private _latestDecision;



    euint32 private _adultSubmissions;
    euint32 private _minorSubmissions;



    event AgeSubmitted(address indexed user, ebool encryptedIsAdult);
    event StatsAccessGranted(address indexed grantedBy, address indexed viewer);



    /// @notice Sends an encrypted age to the contract and receives an encrypted majority decision.
    /// @param encryptedAge The encrypted age handle coming from the FHEVM inputs.
    /// @param inputProof The FHE input proof that authenticates the encryptedAge handle.
    function submitAge(externalEuint8 encryptedAge, bytes calldata inputProof) external {
        euint8 age = FHE.fromExternal(encryptedAge, inputProof);
        ebool isAdult = FHE.ge(age, FHE.asEuint8(MINIMUM_ADULT_AGE));



        _latestEncryptedAge[msg.sender] = age;
        _latestDecision[msg.sender] = isAdult;



        euint32 adultIncrement = FHE.select(isAdult, FHE.asEuint32(1), FHE.asEuint32(0));
        ebool isMinor = FHE.not(isAdult);
        euint32 minorIncrement = FHE.select(isMinor, FHE.asEuint32(1), FHE.asEuint32(0));



        _adultSubmissions = FHE.add(_adultSubmissions, adultIncrement);
        _minorSubmissions = FHE.add(_minorSubmissions, minorIncrement);



        _allowPersonalInsights(msg.sender);
        _allowStats(msg.sender);



        emit AgeSubmitted(msg.sender, isAdult);
    }



    /// @notice Allows any operator to share encrypted stats with a target user.
    function allowStats(address viewer) external {
        require(viewer != address(0), "Invalid viewer");
        _allowStats(viewer);
        emit StatsAccessGranted(msg.sender, viewer);
    }



    /// @notice Returns the encrypted age that the user submitted last.
    function getLatestAge(address user) external view returns (euint8) {
        return _latestEncryptedAge[user];
    }



    /// @notice Returns the encrypted majority decision for the user.
    function getLatestDecision(address user) external view returns (ebool) {
        return _latestDecision[user];
    }



    /// @notice Returns the encrypted number of submissions that passed the >= 18 check.
    function getAdultSubmissions() external view returns (euint32) {
        return _adultSubmissions;
    }



    /// @notice Returns the encrypted number of submissions that were flagged as minors.
    function getMinorSubmissions() external view returns (euint32) {
        return _minorSubmissions;
    }



    function _allowPersonalInsights(address user) private {
        FHE.allowThis(_latestEncryptedAge[user]);
        FHE.allowThis(_latestDecision[user]);
        FHE.allow(_latestEncryptedAge[user], user);
        FHE.allow(_latestDecision[user], user);
    }



    function _allowStats(address user) private {
        FHE.allow(_adultSubmissions, user);
        FHE.allow(_minorSubmissions, user);
        FHE.allowThis(_adultSubmissions);
        FHE.allowThis(_minorSubmissions);
    }
}



