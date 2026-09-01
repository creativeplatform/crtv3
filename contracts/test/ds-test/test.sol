// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.5.0;

contract DSTest {
    event log(string);
    event log_named_string(string key, string val);
    event log_named_address(string key, address val);
    event log_named_uint(string key, uint val);
    event log_named_bytes32(string key, bytes32 val);

    bool public IS_TEST = true;
    bool private _failed;

    function fail() internal {
        _failed = true;
    }

    function failed() public returns (bool) {
        return _failed;
    }

    function assertTrue(bool condition) internal {
        if (!condition) {
            emit log("Error: Assertion Failed");
            fail();
        }
    }

    function assertEq(address a, address b) internal {
        if (a != b) {
            emit log("Error: a == b not satisfied [address]");
            emit log_named_address("  Expected", b);
            emit log_named_address("    Actual", a);
            fail();
        }
    }

    function assertEq(uint a, uint b) internal {
        if (a != b) {
            emit log("Error: a == b not satisfied [uint]");
            emit log_named_uint("  Expected", b);
            emit log_named_uint("    Actual", a);
            fail();
        }
    }

    function assertEq(string memory a, string memory b) internal {
        if (keccak256(abi.encodePacked(a)) != keccak256(abi.encodePacked(b))) {
            emit log("Error: a == b not satisfied [string]");
            emit log_named_string("  Expected", b);
            emit log_named_string("    Actual", a);
            fail();
        }
    }

    function assertEq(bool a, bool b) internal {
        if (a != b) {
            emit log("Error: a == b not satisfied [bool]");
            fail();
        }
    }
}
