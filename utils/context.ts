export const SITE_LOGO = '/grant-logo.png'
export const CREATIVE_LOGO_BLK = '/Blog-Logo_blk.png'
export const CREATIVE_LOGO_WHT = '/Blog-Logo_wht.png'
export const CREATIVE_ICON = '/creative_logo_only.png'
export const SITE_NAME = 'CREATIVE TV'

export const ACCOUNT_FACTORY_ADDRESS = {
  "sepolia": '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
  "polygon": '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
}
export const ACCOUNT_FACTORY_ABI = [
  {
    "type": "event",
    "name": "AdminUpdated",
    "inputs": [
      {
        "type": "address",
        "name": "signer",
        "indexed": true,
        "internalType": "address"
      },
      {
        "type": "bool",
        "name": "isAdmin",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ContractURIUpdated",
    "inputs": [
      {
        "type": "string",
        "name": "prevURI",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "newURI",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "outputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SignerPermissionsUpdated",
    "inputs": [
      {
        "type": "address",
        "name": "authorizingSigner",
        "indexed": true,
        "internalType": "address"
      },
      {
        "type": "address",
        "name": "targetSigner",
        "indexed": true,
        "internalType": "address"
      },
      {
        "type": "tuple",
        "name": "permissions",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "uint8",
            "name": "isAdmin",
            "internalType": "uint8"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "permissionStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "permissionEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "bytes32",
            "name": "uid",
            "internalType": "bytes32"
          }
        ],
        "indexed": false,
        "internalType": "struct IAccountPermissions.SignerPermissionRequest"
      }
    ],
    "outputs": [],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "addDeposit",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "contractURI",
    "inputs": [],
    "outputs": [
      {
        "type": "string",
        "name": "",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "type": "address",
        "name": "_target",
        "internalType": "address"
      },
      {
        "type": "uint256",
        "name": "_value",
        "internalType": "uint256"
      },
      {
        "type": "bytes",
        "name": "_calldata",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "executeBatch",
    "inputs": [
      {
        "type": "address[]",
        "name": "_target",
        "internalType": "address[]"
      },
      {
        "type": "uint256[]",
        "name": "_value",
        "internalType": "uint256[]"
      },
      {
        "type": "bytes[]",
        "name": "_calldata",
        "internalType": "bytes[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAllActiveSigners",
    "inputs": [],
    "outputs": [
      {
        "type": "tuple[]",
        "name": "signers",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "startTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "endTimestamp",
            "internalType": "uint128"
          }
        ],
        "internalType": "struct IAccountPermissions.SignerPermissions[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllAdmins",
    "inputs": [],
    "outputs": [
      {
        "type": "address[]",
        "name": "",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllSigners",
    "inputs": [],
    "outputs": [
      {
        "type": "tuple[]",
        "name": "signers",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "startTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "endTimestamp",
            "internalType": "uint128"
          }
        ],
        "internalType": "struct IAccountPermissions.SignerPermissions[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMessageHash",
    "inputs": [
      {
        "type": "bytes32",
        "name": "_hash",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "type": "bytes32",
        "name": "",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPermissionsForSigner",
    "inputs": [
      {
        "type": "address",
        "name": "signer",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "type": "tuple",
        "name": "",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "startTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "endTimestamp",
            "internalType": "uint128"
          }
        ],
        "internalType": "struct IAccountPermissions.SignerPermissions"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isActiveSigner",
    "inputs": [
      {
        "type": "address",
        "name": "signer",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": "",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAdmin",
    "inputs": [
      {
        "type": "address",
        "name": "_account",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": "",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isValidSignature",
    "inputs": [
      {
        "type": "bytes32",
        "name": "_hash",
        "internalType": "bytes32"
      },
      {
        "type": "bytes",
        "name": "_signature",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "type": "bytes4",
        "name": "magicValue",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onERC1155BatchReceived",
    "inputs": [
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "uint256[]",
        "name": "",
        "internalType": "uint256[]"
      },
      {
        "type": "uint256[]",
        "name": "",
        "internalType": "uint256[]"
      },
      {
        "type": "bytes",
        "name": "",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "type": "bytes4",
        "name": "",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onERC1155Received",
    "inputs": [
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "uint256",
        "name": "",
        "internalType": "uint256"
      },
      {
        "type": "uint256",
        "name": "",
        "internalType": "uint256"
      },
      {
        "type": "bytes",
        "name": "",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "type": "bytes4",
        "name": "",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onERC721Received",
    "inputs": [
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      },
      {
        "type": "uint256",
        "name": "",
        "internalType": "uint256"
      },
      {
        "type": "bytes",
        "name": "",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "type": "bytes4",
        "name": "",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setContractURI",
    "inputs": [
      {
        "type": "string",
        "name": "_uri",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPermissionsForSigner",
    "inputs": [
      {
        "type": "tuple",
        "name": "_req",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "uint8",
            "name": "isAdmin",
            "internalType": "uint8"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "permissionStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "permissionEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "bytes32",
            "name": "uid",
            "internalType": "bytes32"
          }
        ],
        "internalType": "struct IAccountPermissions.SignerPermissionRequest"
      },
      {
        "type": "bytes",
        "name": "_signature",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "type": "bytes4",
        "name": "interfaceId",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": "",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "verifySignerPermissionRequest",
    "inputs": [
      {
        "type": "tuple",
        "name": "req",
        "components": [
          {
            "type": "address",
            "name": "signer",
            "internalType": "address"
          },
          {
            "type": "uint8",
            "name": "isAdmin",
            "internalType": "uint8"
          },
          {
            "type": "address[]",
            "name": "approvedTargets",
            "internalType": "address[]"
          },
          {
            "type": "uint256",
            "name": "nativeTokenLimitPerTransaction",
            "internalType": "uint256"
          },
          {
            "type": "uint128",
            "name": "permissionStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "permissionEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityStartTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "uint128",
            "name": "reqValidityEndTimestamp",
            "internalType": "uint128"
          },
          {
            "type": "bytes32",
            "name": "uid",
            "internalType": "bytes32"
          }
        ],
        "internalType": "struct IAccountPermissions.SignerPermissionRequest"
      },
      {
        "type": "bytes",
        "name": "signature",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": "success",
        "internalType": "bool"
      },
      {
        "type": "address",
        "name": "signer",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdrawDepositTo",
    "inputs": [
      {
        "type": "address",
        "name": "withdrawAddress",
        "internalType": "address payable"
      },
      {
        "type": "uint256",
        "name": "amount",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "name": "",
    "inputs": [],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "constructor",
    "name": "",
    "inputs": [
      {
        "type": "address",
        "name": "_defaultAdmin"
      },
      {
        "type": "address",
        "name": "_entrypoint"
      },
      {
        "type": "tuple[]",
        "name": "_defaultExtensions",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "error",
    "name": "InvalidCodeAtRange",
    "inputs": [
      {
        "type": "uint256",
        "name": "_size"
      },
      {
        "type": "uint256",
        "name": "_start"
      },
      {
        "type": "uint256",
        "name": "_end"
      }
    ],
    "outputs": []
  },
  {
    "type": "error",
    "name": "WriteError",
    "inputs": [],
    "outputs": []
  },
  {
    "type": "event",
    "name": "AccountCreated",
    "inputs": [
      {
        "type": "address",
        "name": "account",
        "indexed": true
      },
      {
        "type": "address",
        "name": "accountAdmin",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "ExtensionAdded",
    "inputs": [
      {
        "type": "string",
        "name": "name",
        "indexed": true
      },
      {
        "type": "address",
        "name": "implementation",
        "indexed": true
      },
      {
        "type": "tuple",
        "name": "extension",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "ExtensionRemoved",
    "inputs": [
      {
        "type": "string",
        "name": "name",
        "indexed": true
      },
      {
        "type": "tuple",
        "name": "extension",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "ExtensionReplaced",
    "inputs": [
      {
        "type": "string",
        "name": "name",
        "indexed": true
      },
      {
        "type": "address",
        "name": "implementation",
        "indexed": true
      },
      {
        "type": "tuple",
        "name": "extension",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "FunctionDisabled",
    "inputs": [
      {
        "type": "string",
        "name": "name",
        "indexed": true
      },
      {
        "type": "bytes4",
        "name": "functionSelector",
        "indexed": true
      },
      {
        "type": "tuple",
        "name": "extMetadata",
        "components": [
          {
            "type": "string",
            "name": "name"
          },
          {
            "type": "string",
            "name": "metadataURI"
          },
          {
            "type": "address",
            "name": "implementation"
          }
        ]
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "FunctionEnabled",
    "inputs": [
      {
        "type": "string",
        "name": "name",
        "indexed": true
      },
      {
        "type": "bytes4",
        "name": "functionSelector",
        "indexed": true
      },
      {
        "type": "tuple",
        "name": "extFunction",
        "components": [
          {
            "type": "bytes4",
            "name": "functionSelector"
          },
          {
            "type": "string",
            "name": "functionSignature"
          }
        ]
      },
      {
        "type": "tuple",
        "name": "extMetadata",
        "components": [
          {
            "type": "string",
            "name": "name"
          },
          {
            "type": "string",
            "name": "metadataURI"
          },
          {
            "type": "address",
            "name": "implementation"
          }
        ]
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "RoleAdminChanged",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role",
        "indexed": true
      },
      {
        "type": "bytes32",
        "name": "previousAdminRole",
        "indexed": true
      },
      {
        "type": "bytes32",
        "name": "newAdminRole",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "RoleGranted",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role",
        "indexed": true
      },
      {
        "type": "address",
        "name": "account",
        "indexed": true
      },
      {
        "type": "address",
        "name": "sender",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "RoleRevoked",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role",
        "indexed": true
      },
      {
        "type": "address",
        "name": "account",
        "indexed": true
      },
      {
        "type": "address",
        "name": "sender",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "SignerAdded",
    "inputs": [
      {
        "type": "address",
        "name": "account",
        "indexed": true
      },
      {
        "type": "address",
        "name": "signer",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "event",
    "name": "SignerRemoved",
    "inputs": [
      {
        "type": "address",
        "name": "account",
        "indexed": true
      },
      {
        "type": "address",
        "name": "signer",
        "indexed": true
      }
    ],
    "outputs": []
  },
  {
    "type": "fallback",
    "name": "",
    "inputs": [],
    "outputs": []
  },
  {
    "type": "function",
    "name": "DEFAULT_ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "type": "bytes32",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "_disableFunctionInExtension",
    "inputs": [
      {
        "type": "string",
        "name": "_extensionName"
      },
      {
        "type": "bytes4",
        "name": "_functionSelector"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "accountImplementation",
    "inputs": [],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addExtension",
    "inputs": [
      {
        "type": "tuple",
        "name": "_extension",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createAccount",
    "inputs": [
      {
        "type": "address",
        "name": "_admin"
      },
      {
        "type": "bytes",
        "name": "_data"
      }
    ],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "defaultExtensions",
    "inputs": [],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "disableFunctionInExtension",
    "inputs": [
      {
        "type": "string",
        "name": "_extensionName"
      },
      {
        "type": "bytes4",
        "name": "_functionSelector"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableFunctionInExtension",
    "inputs": [
      {
        "type": "string",
        "name": "_extensionName"
      },
      {
        "type": "tuple",
        "name": "_function",
        "components": [
          {
            "type": "bytes4",
            "name": "functionSelector"
          },
          {
            "type": "string",
            "name": "functionSignature"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "entrypoint",
    "inputs": [],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAccounts",
    "inputs": [
      {
        "type": "uint256",
        "name": "_start"
      },
      {
        "type": "uint256",
        "name": "_end"
      }
    ],
    "outputs": [
      {
        "type": "address[]",
        "name": "accounts"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAccountsOfSigner",
    "inputs": [
      {
        "type": "address",
        "name": "signer"
      }
    ],
    "outputs": [
      {
        "type": "address[]",
        "name": "accounts"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAddress",
    "inputs": [
      {
        "type": "address",
        "name": "_adminSigner"
      },
      {
        "type": "bytes",
        "name": "_data"
      }
    ],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllAccounts",
    "inputs": [],
    "outputs": [
      {
        "type": "address[]",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllExtensions",
    "inputs": [],
    "outputs": [
      {
        "type": "tuple[]",
        "name": "allExtensions",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getExtension",
    "inputs": [
      {
        "type": "string",
        "name": "extensionName"
      }
    ],
    "outputs": [
      {
        "type": "tuple",
        "name": "",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getImplementationForFunction",
    "inputs": [
      {
        "type": "bytes4",
        "name": "_functionSelector"
      }
    ],
    "outputs": [
      {
        "type": "address",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getMetadataForFunction",
    "inputs": [
      {
        "type": "bytes4",
        "name": "functionSelector"
      }
    ],
    "outputs": [
      {
        "type": "tuple",
        "name": "",
        "components": [
          {
            "type": "string",
            "name": "name"
          },
          {
            "type": "string",
            "name": "metadataURI"
          },
          {
            "type": "address",
            "name": "implementation"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleAdmin",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      }
    ],
    "outputs": [
      {
        "type": "bytes32",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMember",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "uint256",
        "name": "index"
      }
    ],
    "outputs": [
      {
        "type": "address",
        "name": "member"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleMemberCount",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      }
    ],
    "outputs": [
      {
        "type": "uint256",
        "name": "count"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "address",
        "name": "account"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "address",
        "name": "account"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasRoleWithSwitch",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "address",
        "name": "account"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isRegistered",
    "inputs": [
      {
        "type": "address",
        "name": "_account"
      }
    ],
    "outputs": [
      {
        "type": "bool",
        "name": ""
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "multicall",
    "inputs": [
      {
        "type": "bytes[]",
        "name": "data"
      }
    ],
    "outputs": [
      {
        "type": "bytes[]",
        "name": "results"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onRegister",
    "inputs": [
      {
        "type": "bytes32",
        "name": "_salt"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onSignerAdded",
    "inputs": [
      {
        "type": "address",
        "name": "_signer"
      },
      {
        "type": "bytes32",
        "name": "_salt"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onSignerRemoved",
    "inputs": [
      {
        "type": "address",
        "name": "_signer"
      },
      {
        "type": "bytes32",
        "name": "_salt"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeExtension",
    "inputs": [
      {
        "type": "string",
        "name": "_extensionName"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceRole",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "address",
        "name": "account"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "replaceExtension",
    "inputs": [
      {
        "type": "tuple",
        "name": "_extension",
        "components": [
          {
            "type": "tuple",
            "name": "metadata",
            "components": [
              {
                "type": "string",
                "name": "name"
              },
              {
                "type": "string",
                "name": "metadataURI"
              },
              {
                "type": "address",
                "name": "implementation"
              }
            ]
          },
          {
            "type": "tuple[]",
            "name": "functions",
            "components": [
              {
                "type": "bytes4",
                "name": "functionSelector"
              },
              {
                "type": "string",
                "name": "functionSignature"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {
        "type": "bytes32",
        "name": "role"
      },
      {
        "type": "address",
        "name": "account"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "totalAccounts",
    "inputs": [],
    "outputs": [
      {
        "type": "uint256",
        "name": ""
      }
    ],
    "stateMutability": "view"
  }
];

export const CURRENT_PRICES = [
  {
    name: "Fan",
    features: ["Free-mium Content", "Creative Influence"],
    info: "Enjoy content that inspires and elevate your influence!"
  },
  {
    name: "Creator",
    price: "$10",
    popular: true,
    features: ["Premium Content" , "Creative Earnings", "Content Insights" ],
    info: "Unlock premium access and earn as you create."
  },
  {
    name: "Supporter",
    price: "$100",
    features: ["Exclusive Content", "Vesting Opportunities", "Live Portfolio Analytics", "Profit Perks", "Personalized Support" ],
    info: "Experience investment exclusivity with top-tier content and insights."
  },
  {
    name: "Business",
    price: "$250",
    features: ["Ad Privileges" , "Ad Metrics", "Referral Rewards", "VIP Support"],
    info: "Amplify your business with advanced ad capabilities tailored for success."
  }
];

export const ROLES = {
    "sepolia": {
        "test": {
          "address": "0xbc20b339c0dc2793ab4ecece98567f65632015b7",
          "role": "001",
        },
    },
    "polygon": {
        "contributor": {
          "address": "0xb9c69af58109927cc2dcce8043f82158f7b96ca7",
          "role": "001",
        },
        "creator": {
          "address": "0xb6b645c3e2025cf69983983266d16a0aa323e2b0",
          "role": "002",
        },
        "investor": {
          "address": "0xace23c0669bf52c50d30c33c7e4adc78cc8754ec",
          "role": "003",
        },
        "brand": {
          "address": "0x480c5081793506ffb8e4a85390e4ac7c19f2d717",
          "role": "004",
        },
        "fan": {
          "address": "0xe174caa294999ec622988242641a27c11e6c22d8",
          "role": "005",
        },
    }
}
export const ROLES_ABI = [
  {
    "inputs": [],
    "name": "CANNOT_APPROVE_SELF",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CANT_BE_SMALLER_THAN_SUPPLY",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CANT_EXTEND_NON_EXPIRING_KEY",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "GAS_REFUND_FAILED",
    "type": "error"
  },
  {
    "inputs":[],
    "name": "INSUFFICIENT_ERC20_VALUE",
    "type": "error"
  },
  {
    "inputs":[],
    "name": "INSUFFICIENT_VALUE",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "INVALID_ADDRESS",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "hookIndex",
        "type": "uint8"
      }
    ],
    "name": "INVALID_HOOK",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "INVALID_LENGTH",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "INVALID_TOKEN",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "KEY_NOT_VALID",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "KEY_TRANSFERS_DISABLED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LOCK_HAS_CHANGED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "LOCK_SOLD_OUT",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MAX_KEYS_REACHED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MIGRATION_REQUIRED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NON_COMPLIANT_ERC721_RECEIVER",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NON_RENEWABLE_LOCK",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NOT_ENOUGH_FUNDS",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NOT_ENOUGH_TIME",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NOT_READY_FOR_RENEWAL",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NO_SUCH_KEY",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NULL_VALUE",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ONLY_KEY_MANAGER_OR_APPROVED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ONLY_LOCK_MANAGER",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ONLY_LOCK_MANAGER_OR_KEY_GRANTER",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OUT_OF_RANGE",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OWNER_CANT_BE_ADDRESS_ZERO",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SCHEMA_VERSION_NOT_CORRECT",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TRANSFER_TO_SELF",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UNAUTHORIZED",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UNAUTHORIZED_KEY_MANAGER_UPDATE",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "approved",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "operator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "approved",
        "type": "bool"
      }
    ],
    "name": "ApprovalForAll",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed":true,
        "internalType":"uint256",
        "name":"tokenId",
        "type":"uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sendTo",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refund",
        "type": "uint256"
      }
    ],
    "name": "CancelKey",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "onKeyPurchaseHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onKeyCancelHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onValidKeyHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onTokenURIHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onKeyTransferHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onKeyExtendHook",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "onKeyGrantHook",
        "type": "address"
      }
    ],
    "name": "EventHooksUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newExpiration",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "timeAdded",
        "type": "bool"
      }
    ],
    "name": "ExpirationChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "ExpireKey",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refundValue",
        "type": "uint256"
      }
    ],
    "name": "GasRefundValueChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "receiver",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refundedAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      }
    ],
    "name": "GasRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newTimestamp",
        "type": "uint256"
      }
    ],
    "name": "KeyExtended",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "KeyGranterAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "KeyGranterRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "_newManager",
        "type": "address"
      }
    ],
    "name": "KeyManagerChanged",
    "type": "event"},
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "updatedRecordsCount",
        "type": "uint256"
      }
    ],
    "name": "KeysMigrated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "expirationDuration",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "maxNumberOfKeys",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "maxKeysPerAcccount",
        "type": "uint256"
      }
    ],
    "name": "LockConfig",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "LockManagerAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "LockManagerRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {"indexed": false,
       "internalType": "string",
       "name": "baseTokenURI",
       "type": "string"
      }
    ],
    "name": "LockMetadata",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldKeyPrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "keyPrice",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "oldTokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      }
    ],
    "name": "PricingChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "referrer",
        "type": "address"},
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "fee",
        "type": "uint256"
      }
    ],
    "name": "ReferrerFee",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "freeTrialLength",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "refundPenaltyBasisPoints",
        "type": "uint256"
      }
    ],
    "name": "RefundPenaltyChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "transferFeeBasisPoints",
        "type": "uint256"
      }
    ],
    "name": "TransferFeeChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "lockAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "unlockAddress",
        "type": "address"
      }
    ],
    "name": "UnlockCallFailed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "Withdrawal",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "addLockManager",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_approved",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type":"function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_keyOwner",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "burn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "cancelAndRefund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "expirationDuration",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      }
    ],
    "name": "expireAndRefundFor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_value",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_referrer",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "_data",
        "type": "bytes"
      }
    ],
    "name": "extend",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "freeTrialLength",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "gasRefundValue",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "_refundValue",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "getApproved",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "getCancelAndRefundValue",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "refund",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_keyOwner",
        "type": "address"
      }
    ],
    "name": "getHasValidKey",
    "outputs": [
      {
        "internalType": "bool",
        "name": "isValid",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_time",
        "type": "uint256"
      }
    ],
    "name": "getTransferFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs":
      [
        {
          "internalType": "uint256",
          "name":
            "_tokenId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_duration",
          "type": "uint256"
        }
      ],
    "name": "grantKeyExtension",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_recipients",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_expirationTimestamps",
        "type": "uint256[]"
      },
      {
        "internalType": "address[]",
        "name": "_keyManagers",
        "type": "address[]"
      }
    ],
    "name": "grantKeys",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_lockCreator",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_expirationDuration",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_tokenAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_keyPrice",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_maxNumberOfKeys",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_lockName",
        "type": "string"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_owner",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_operator",
        "type": "address"
      }
    ],
    "name": "isApprovedForAll",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "isLockManager",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "isOwner",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_referrer",
        "type": "address"
      }
    ],
    "name": "isRenewable",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "isValidKey",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "keyExpirationTimestampFor",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "keyManagerOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "keyPrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "lendKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxKeysPerAddress",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxNumberOfKeys",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenIdFrom",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_tokenIdTo",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      }
    ],
    "name": "mergeKeys",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes",
        "name": "",
        "type": "bytes"
      }
    ],
    "name": "migrate",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "numberOfOwners",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onKeyCancelHook",
    "outputs": [
      {
        "internalType": "contract ILockKeyCancelHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onKeyExtendHook",
    "outputs": [
      {
        "internalType": "contract ILockKeyExtendHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onKeyGrantHook",
    "outputs": [
      {
        "internalType": "contract ILockKeyGrantHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onKeyPurchaseHook",
    "outputs": [
      {
        "internalType": "contract ILockKeyPurchaseHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type":"function"
  },
  {
    "inputs": [],
    "name": "onKeyTransferHook",
    "outputs": [
      {
        "internalType": "contract ILockKeyTransferHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onTokenURIHook",
    "outputs": [
      {
        "internalType": "contract ILockTokenURIHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "onValidKeyHook",
    "outputs": [
      {
        "internalType": "contract ILockValidKeyHook",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "ownerOf",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "publicLockVersion",
    "outputs": [
      {
        "internalType": "uint16",
        "name": "",
        "type": "uint16"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256[]",
        "name": "_values",
        "type": "uint256[]"
      },
      {
        "internalType": "address[]",
        "name": "_recipients",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "_referrers",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "_keyManagers",
        "type": "address[]"
      },
      {
        "internalType": "bytes[]",
        "name": "_data",
        "type": "bytes[]"
      }
    ],
    "name": "purchase",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_referrer",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "_data",
        "type": "bytes"
      }
    ],
    "name": "purchasePriceFor",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "minKeyPrice",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "referrerFees",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "refundPenaltyBasisPoints",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_referrer",
        "type": "address"
      }
    ],
    "name": "renewMembershipFor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceLockManager",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "_data",
        "type": "bytes"
      }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "schemaVersion",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "_approved",
        "type": "bool"
      }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_onKeyPurchaseHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onKeyCancelHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onValidKeyHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onTokenURIHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onKeyTransferHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onKeyExtendHook",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_onKeyGrantHook",
        "type": "address"
      }
    ],
    "name": "setEventHooks",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_refundValue",
        "type": "uint256"
      }
    ],
    "name": "setGasRefundValue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_keyManager",
        "type": "address"
      }
    ],
    "name": "setKeyManagerOf",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_lockName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_lockSymbol",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_baseTokenURI",
        "type": "string"
      }
    ],
    "name": "setLockMetadata",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "setOwner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_referrer",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_feeBasisPoint",
        "type": "uint256"
      }
    ],
    "name": "setReferrerFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenIdFrom",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_timeShared",
        "type": "uint256"
      }
    ],
    "name": "shareKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      }
    ],
    "name": "tokenByIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_keyOwner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "tokenURI",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_keyOwner",
        "type": "address"
      }
    ],
    "name": "totalKeys",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "_totalKeysCreated",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "transferFeeBasisPoints",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_from",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_tokenId",
        "type": "uint256"
      }
    ],
    "name": "unlendKey",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unlockProtocol",
    "outputs": [
      {
        "internalType": "contract IUnlock",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_keyPrice",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_tokenAddress",
        "type": "address"
      }
    ],
    "name": "updateKeyPricing",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_newExpirationDuration",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_maxNumberOfKeys",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_maxKeysPerAcccount",
        "type":"uint256"
      }
    ],
    "name": "updateLockConfig",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_freeTrialLength",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_refundPenaltyBasisPoints",
        "type": "uint256"
      }
    ],
    "name": "updateRefundPenalty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "updateSchemaVersion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_transferFeeBasisPoints",
        "type": "uint256"
      }
    ],
    "name": "updateTransferFee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_tokenAddress",
        "type": "address"
      },
      {
        "internalType": "address payable",
        "name": "_recipient",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "_amount",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
]

// FOOTER
const currentYear = new Date().getFullYear();

export const FOOTER_LINKS = {
    whitepaper: 'https://creativeplatform.xyz/docs/resources/whitepaper',
    blog: 'https://blog.creativeplatform.xyz',
    about_us: 'https://creativeplatform.xyz/docs/intro',
    releases: 'https://creative-org-dao.canny.io/changelog',
    pricing: 'https://app.unlock-protocol.com/checkout?id=cac7160c-260b-467b-9012-0864039df0e3',
    tutorial: 'https://crew3.xyz/c/thecreativedao/questboard',
    cookie_policy: 'https://creativeplatform.xyz/docs/cookie-policy',
    privacy_policy: 'https://creativeplatform.xyz/docs/privacy-policy',
    terms_and_conditions: 'https://creativeplatform.xyz/docs/terms-and-conditions',
    status: 'https://thecreative.grafana.net/public-dashboards/0d59c3754efd4cf5be8298ff3b24b685?orgId=1',
    terminal: 'https://app.creativeplatform.xyz',
}
  
export const SITE_COPYRIGHT = `© ${currentYear} Creative Organization DAO, LLC. All rights reserved.`
  
// LINKS
export const SOCIAL_LINKS = {
    twitter: 'https://twitter.com/creativecrtv',
    github: 'https://github.com/creativeplatform',
    discord: 'https://discord.com/servers/creative-779364937503604777',
    lens: 'https://lensfrens.xyz/thecreative',
    linkedin: 'https://www.linkedin.com/company/creativeplatform',
    instagram: 'https://www.instagram.com/creativecrtv/',
    warpcast: 'https://warpcast.com/thecreative.eth',
    email: 'mailto:creatives@creativeplatform.xyz',
}

// Profile.tsx
export const PFP = '/0.png'

export const PROFILE_VIDEOS = {
  tooltip: 'list of your uploaded videos',
  tooltip_position: 'bottom',
}

export const PROFILE_CAMPAIGNS = {
  tooltip: 'list of your campaigns',
  tooltip_position: 'bottom',
}

// Livepeer API
export const LIVEPEER_API_URL = 'https://livepeer.com/api'
export const LIVEPEER_HERO_PLAYBACK_ID = 'cbd1dw72qst9xmps' // Welcome To Creative Organization DAO
export const LIVEPEER_FEATURED_PLAYBACK_ID = '5c2bzf537qbq0r7o' // The Creative Podcast Episode 03

// HERO SECTION
export const HERO_NAME = {
  top: 'Record Once,',
  bottom: 'Use Everywhere!',
}
  
export const HERO_DESCRIPTION = `${SITE_NAME} is a decentralized live streaming platform that puts you in control of your content and earnings. Get paid 100% of streaming revenue, have access to your own social token, and monetize your content into NFTs.`
  
export const HERO_BUTTONS = {
  primary: { text: 'Get Started', href: 'https://app.unlock-protocol.com/checkout?id=bbbcff5f-835d-4fa3-9761-988d5da9da18' },
  secondary: { text: 'How It Works', href: 'https://creativeplatform.xyz/docs/intro', target: '_blank' },
}
  
export const HERO_IMAGE = 'https://bafybeiefwmq6zykvyhwih5qbhucxrc34zbtxjbwboz7hdgkyh3u6p2ykfa.ipfs.nftstorage.link'

// FEATURED VIDEO
export const FEATURED_TEXT = {
  top: 'Record. Watch. Brand.',
  middle: 'Stream. Create. Inspire.',
  bottom: 'Engage. Dream. Earn.',
}