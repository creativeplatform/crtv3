import { ContractOptions } from "thirdweb";
import { Abi } from 'viem';

export const SITE_LOGO = '/grant-logo.png';
export const CREATIVE_LOGO_BLK = '/Blog-Logo_blk.png';
export const CREATIVE_LOGO_WHT = '/Blog-Logo_wht.png';
export const CREATIVE_ICON = '/creative_logo_only.png';
export const SITE_NAME = 'CREATIVE TV';

export const STEPPER_FORM_KEYS = {
  1: ['title', 'description', 'location', 'category'],
  2: ['video'],
  3: ['thumbnail'],
} as const;

export const CREATIVE_ADDRESS = '0x1Fde40a4046Eda0cA0539Dd6c77ABF8933B94260';

export const ACCOUNT_FACTORY_ADDRESS = {
  sepolia: '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
  polygon: '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
  base: '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
  optimism: '0xE90DebFD907F5B655f22bfC16083E45994d708bE',
};

export const ACCOUNT_FACTORY_ABI = [
  {
    type: 'event',
    name: 'AdminUpdated',
    inputs: [
      {
        type: 'address',
        name: 'signer',
        indexed: true,
        internalType: 'address',
      },
      {
        type: 'bool',
        name: 'isAdmin',
        indexed: false,
        internalType: 'bool',
      },
    ],
    outputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ContractURIUpdated',
    inputs: [
      {
        type: 'string',
        name: 'prevURI',
        indexed: false,
        internalType: 'string',
      },
      {
        type: 'string',
        name: 'newURI',
        indexed: false,
        internalType: 'string',
      },
    ],
    outputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SignerPermissionsUpdated',
    inputs: [
      {
        type: 'address',
        name: 'authorizingSigner',
        indexed: true,
        internalType: 'address',
      },
      {
        type: 'address',
        name: 'targetSigner',
        indexed: true,
        internalType: 'address',
      },
      {
        type: 'tuple',
        name: 'permissions',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'uint8',
            name: 'isAdmin',
            internalType: 'uint8',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'permissionStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'permissionEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'bytes32',
            name: 'uid',
            internalType: 'bytes32',
          },
        ],
        indexed: false,
        internalType: 'struct IAccountPermissions.SignerPermissionRequest',
      },
    ],
    outputs: [],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'addDeposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'contractURI',
    inputs: [],
    outputs: [
      {
        type: 'string',
        name: '',
        internalType: 'string',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'execute',
    inputs: [
      {
        type: 'address',
        name: '_target',
        internalType: 'address',
      },
      {
        type: 'uint256',
        name: '_value',
        internalType: 'uint256',
      },
      {
        type: 'bytes',
        name: '_calldata',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeBatch',
    inputs: [
      {
        type: 'address[]',
        name: '_target',
        internalType: 'address[]',
      },
      {
        type: 'uint256[]',
        name: '_value',
        internalType: 'uint256[]',
      },
      {
        type: 'bytes[]',
        name: '_calldata',
        internalType: 'bytes[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAllActiveSigners',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        name: 'signers',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'startTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'endTimestamp',
            internalType: 'uint128',
          },
        ],
        internalType: 'struct IAccountPermissions.SignerPermissions[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllAdmins',
    inputs: [],
    outputs: [
      {
        type: 'address[]',
        name: '',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllSigners',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        name: 'signers',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'startTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'endTimestamp',
            internalType: 'uint128',
          },
        ],
        internalType: 'struct IAccountPermissions.SignerPermissions[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMessageHash',
    inputs: [
      {
        type: 'bytes32',
        name: '_hash',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        type: 'bytes32',
        name: '',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPermissionsForSigner',
    inputs: [
      {
        type: 'address',
        name: 'signer',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        type: 'tuple',
        name: '',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'startTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'endTimestamp',
            internalType: 'uint128',
          },
        ],
        internalType: 'struct IAccountPermissions.SignerPermissions',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isActiveSigner',
    inputs: [
      {
        type: 'address',
        name: 'signer',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAdmin',
    inputs: [
      {
        type: 'address',
        name: '_account',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isValidSignature',
    inputs: [
      {
        type: 'bytes32',
        name: '_hash',
        internalType: 'bytes32',
      },
      {
        type: 'bytes',
        name: '_signature',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bytes4',
        name: 'magicValue',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'onERC1155BatchReceived',
    inputs: [
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'uint256[]',
        name: '',
        internalType: 'uint256[]',
      },
      {
        type: 'uint256[]',
        name: '',
        internalType: 'uint256[]',
      },
      {
        type: 'bytes',
        name: '',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bytes4',
        name: '',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onERC1155Received',
    inputs: [
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'uint256',
        name: '',
        internalType: 'uint256',
      },
      {
        type: 'uint256',
        name: '',
        internalType: 'uint256',
      },
      {
        type: 'bytes',
        name: '',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bytes4',
        name: '',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onERC721Received',
    inputs: [
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'address',
        name: '',
        internalType: 'address',
      },
      {
        type: 'uint256',
        name: '',
        internalType: 'uint256',
      },
      {
        type: 'bytes',
        name: '',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bytes4',
        name: '',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setContractURI',
    inputs: [
      {
        type: 'string',
        name: '_uri',
        internalType: 'string',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPermissionsForSigner',
    inputs: [
      {
        type: 'tuple',
        name: '_req',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'uint8',
            name: 'isAdmin',
            internalType: 'uint8',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'permissionStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'permissionEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'bytes32',
            name: 'uid',
            internalType: 'bytes32',
          },
        ],
        internalType: 'struct IAccountPermissions.SignerPermissionRequest',
      },
      {
        type: 'bytes',
        name: '_signature',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        type: 'bytes4',
        name: 'interfaceId',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'verifySignerPermissionRequest',
    inputs: [
      {
        type: 'tuple',
        name: 'req',
        components: [
          {
            type: 'address',
            name: 'signer',
            internalType: 'address',
          },
          {
            type: 'uint8',
            name: 'isAdmin',
            internalType: 'uint8',
          },
          {
            type: 'address[]',
            name: 'approvedTargets',
            internalType: 'address[]',
          },
          {
            type: 'uint256',
            name: 'nativeTokenLimitPerTransaction',
            internalType: 'uint256',
          },
          {
            type: 'uint128',
            name: 'permissionStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'permissionEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityStartTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'uint128',
            name: 'reqValidityEndTimestamp',
            internalType: 'uint128',
          },
          {
            type: 'bytes32',
            name: 'uid',
            internalType: 'bytes32',
          },
        ],
        internalType: 'struct IAccountPermissions.SignerPermissionRequest',
      },
      {
        type: 'bytes',
        name: 'signature',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: 'success',
        internalType: 'bool',
      },
      {
        type: 'address',
        name: 'signer',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdrawDepositTo',
    inputs: [
      {
        type: 'address',
        name: 'withdrawAddress',
        internalType: 'address payable',
      },
      {
        type: 'uint256',
        name: 'amount',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    name: '',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'constructor',
    name: '',
    inputs: [
      {
        type: 'address',
        name: '_defaultAdmin',
      },
      {
        type: 'address',
        name: '_entrypoint',
      },
      {
        type: 'tuple[]',
        name: '_defaultExtensions',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    name: 'InvalidCodeAtRange',
    inputs: [
      {
        type: 'uint256',
        name: '_size',
      },
      {
        type: 'uint256',
        name: '_start',
      },
      {
        type: 'uint256',
        name: '_end',
      },
    ],
    outputs: [],
  },
  {
    type: 'error',
    name: 'WriteError',
    inputs: [],
    outputs: [],
  },
  {
    type: 'event',
    name: 'AccountCreated',
    inputs: [
      {
        type: 'address',
        name: 'account',
        indexed: true,
      },
      {
        type: 'address',
        name: 'accountAdmin',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ExtensionAdded',
    inputs: [
      {
        type: 'string',
        name: 'name',
        indexed: true,
      },
      {
        type: 'address',
        name: 'implementation',
        indexed: true,
      },
      {
        type: 'tuple',
        name: 'extension',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ExtensionRemoved',
    inputs: [
      {
        type: 'string',
        name: 'name',
        indexed: true,
      },
      {
        type: 'tuple',
        name: 'extension',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'ExtensionReplaced',
    inputs: [
      {
        type: 'string',
        name: 'name',
        indexed: true,
      },
      {
        type: 'address',
        name: 'implementation',
        indexed: true,
      },
      {
        type: 'tuple',
        name: 'extension',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'FunctionDisabled',
    inputs: [
      {
        type: 'string',
        name: 'name',
        indexed: true,
      },
      {
        type: 'bytes4',
        name: 'functionSelector',
        indexed: true,
      },
      {
        type: 'tuple',
        name: 'extMetadata',
        components: [
          {
            type: 'string',
            name: 'name',
          },
          {
            type: 'string',
            name: 'metadataURI',
          },
          {
            type: 'address',
            name: 'implementation',
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'FunctionEnabled',
    inputs: [
      {
        type: 'string',
        name: 'name',
        indexed: true,
      },
      {
        type: 'bytes4',
        name: 'functionSelector',
        indexed: true,
      },
      {
        type: 'tuple',
        name: 'extFunction',
        components: [
          {
            type: 'bytes4',
            name: 'functionSelector',
          },
          {
            type: 'string',
            name: 'functionSignature',
          },
        ],
      },
      {
        type: 'tuple',
        name: 'extMetadata',
        components: [
          {
            type: 'string',
            name: 'name',
          },
          {
            type: 'string',
            name: 'metadataURI',
          },
          {
            type: 'address',
            name: 'implementation',
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'RoleAdminChanged',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
        indexed: true,
      },
      {
        type: 'bytes32',
        name: 'previousAdminRole',
        indexed: true,
      },
      {
        type: 'bytes32',
        name: 'newAdminRole',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
        indexed: true,
      },
      {
        type: 'address',
        name: 'account',
        indexed: true,
      },
      {
        type: 'address',
        name: 'sender',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
        indexed: true,
      },
      {
        type: 'address',
        name: 'account',
        indexed: true,
      },
      {
        type: 'address',
        name: 'sender',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'SignerAdded',
    inputs: [
      {
        type: 'address',
        name: 'account',
        indexed: true,
      },
      {
        type: 'address',
        name: 'signer',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'SignerRemoved',
    inputs: [
      {
        type: 'address',
        name: 'account',
        indexed: true,
      },
      {
        type: 'address',
        name: 'signer',
        indexed: true,
      },
    ],
    outputs: [],
  },
  {
    type: 'fallback',
    name: '',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    inputs: [],
    outputs: [
      {
        type: 'bytes32',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: '_disableFunctionInExtension',
    inputs: [
      {
        type: 'string',
        name: '_extensionName',
      },
      {
        type: 'bytes4',
        name: '_functionSelector',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'accountImplementation',
    inputs: [],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addExtension',
    inputs: [
      {
        type: 'tuple',
        name: '_extension',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      {
        type: 'address',
        name: '_admin',
      },
      {
        type: 'bytes',
        name: '_data',
      },
    ],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'defaultExtensions',
    inputs: [],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disableFunctionInExtension',
    inputs: [
      {
        type: 'string',
        name: '_extensionName',
      },
      {
        type: 'bytes4',
        name: '_functionSelector',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'enableFunctionInExtension',
    inputs: [
      {
        type: 'string',
        name: '_extensionName',
      },
      {
        type: 'tuple',
        name: '_function',
        components: [
          {
            type: 'bytes4',
            name: 'functionSelector',
          },
          {
            type: 'string',
            name: 'functionSignature',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'entrypoint',
    inputs: [],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAccounts',
    inputs: [
      {
        type: 'uint256',
        name: '_start',
      },
      {
        type: 'uint256',
        name: '_end',
      },
    ],
    outputs: [
      {
        type: 'address[]',
        name: 'accounts',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAccountsOfSigner',
    inputs: [
      {
        type: 'address',
        name: 'signer',
      },
    ],
    outputs: [
      {
        type: 'address[]',
        name: 'accounts',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAddress',
    inputs: [
      {
        type: 'address',
        name: '_adminSigner',
      },
      {
        type: 'bytes',
        name: '_data',
      },
    ],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllAccounts',
    inputs: [],
    outputs: [
      {
        type: 'address[]',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllExtensions',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        name: 'allExtensions',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getExtension',
    inputs: [
      {
        type: 'string',
        name: 'extensionName',
      },
    ],
    outputs: [
      {
        type: 'tuple',
        name: '',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getImplementationForFunction',
    inputs: [
      {
        type: 'bytes4',
        name: '_functionSelector',
      },
    ],
    outputs: [
      {
        type: 'address',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMetadataForFunction',
    inputs: [
      {
        type: 'bytes4',
        name: 'functionSelector',
      },
    ],
    outputs: [
      {
        type: 'tuple',
        name: '',
        components: [
          {
            type: 'string',
            name: 'name',
          },
          {
            type: 'string',
            name: 'metadataURI',
          },
          {
            type: 'address',
            name: 'implementation',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleAdmin',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
    ],
    outputs: [
      {
        type: 'bytes32',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleMember',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'uint256',
        name: 'index',
      },
    ],
    outputs: [
      {
        type: 'address',
        name: 'member',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleMemberCount',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
    ],
    outputs: [
      {
        type: 'uint256',
        name: 'count',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'grantRole',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'address',
        name: 'account',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'address',
        name: 'account',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasRoleWithSwitch',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'address',
        name: 'account',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [
      {
        type: 'address',
        name: '_account',
      },
    ],
    outputs: [
      {
        type: 'bool',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'multicall',
    inputs: [
      {
        type: 'bytes[]',
        name: 'data',
      },
    ],
    outputs: [
      {
        type: 'bytes[]',
        name: 'results',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onRegister',
    inputs: [
      {
        type: 'bytes32',
        name: '_salt',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onSignerAdded',
    inputs: [
      {
        type: 'address',
        name: '_signer',
      },
      {
        type: 'bytes32',
        name: '_salt',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'onSignerRemoved',
    inputs: [
      {
        type: 'address',
        name: '_signer',
      },
      {
        type: 'bytes32',
        name: '_salt',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeExtension',
    inputs: [
      {
        type: 'string',
        name: '_extensionName',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceRole',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'address',
        name: 'account',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'replaceExtension',
    inputs: [
      {
        type: 'tuple',
        name: '_extension',
        components: [
          {
            type: 'tuple',
            name: 'metadata',
            components: [
              {
                type: 'string',
                name: 'name',
              },
              {
                type: 'string',
                name: 'metadataURI',
              },
              {
                type: 'address',
                name: 'implementation',
              },
            ],
          },
          {
            type: 'tuple[]',
            name: 'functions',
            components: [
              {
                type: 'bytes4',
                name: 'functionSelector',
              },
              {
                type: 'string',
                name: 'functionSignature',
              },
            ],
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeRole',
    inputs: [
      {
        type: 'bytes32',
        name: 'role',
      },
      {
        type: 'address',
        name: 'account',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalAccounts',
    inputs: [],
    outputs: [
      {
        type: 'uint256',
        name: '',
      },
    ],
    stateMutability: 'view',
  },
];

export const QUARTERLY_PRICES = [
  {
    name: 'Fan',
    features: ['Free-mium Content', 'Creative Influence'],
    info: 'Enjoy content that inspires and elevate your influence!',
    url: 'https://app.unlock-protocol.com/checkout?id=6aa04eef-d516-4c2d-81ad-b797f1dcf3be',
  },
  {
    name: 'Creator',
    price: '$30',
    popular: true,
    features: ['Premium Content', 'Creative Earnings', 'Content Insights'],
    info: 'Unlock premium access and earn as you create.',
    url: 'https://app.unlock-protocol.com/checkout?id=bbbcff5f-835d-4fa3-9761-988d5da9da18',
  },
  {
    name: 'Supporter',
    price: '$300',
    features: [
      'Exclusive Content',
      'Vesting Opportunities',
      'Live Portfolio Analytics',
      'Profit Perks',
      'Personalized Support',
    ],
    info: 'Experience investment exclusivity with top-tier content and insights.',
    url: 'https://app.unlock-protocol.com/checkout?id=7f9da384-5bae-4075-b02b-90bd197df113',
  },
  {
    name: 'Business',
    price: '$750',
    features: [
      'Ad Privileges',
      'Ad Metrics',
      'Referral Rewards',
      'VIP Support',
    ],
    info: 'Amplify your business with advanced ad capabilities tailored for success.',
    url: 'https://app.unlock-protocol.com/checkout?id=8dd13311-7924-4a62-8c7c-5c832d0f3e70',
  },
];

export const ANNUAL_PRICES = [
  {
    name: 'Fan',
    features: ['Free-mium Content', 'Creative Influence'],
    info: 'Enjoy content that inspires and elevate your influence!',
    url: 'https://app.unlock-protocol.com/checkout?id=6aa04eef-d516-4c2d-81ad-b797f1dcf3be',
  },
  {
    name: 'Creator',
    price: '$120',
    popular: true,
    features: ['Premium Content', 'Creative Earnings', 'Content Insights'],
    info: 'Unlock premium access and earn as you create.',
    url: 'https://app.unlock-protocol.com/checkout?id=6808e7ce-909a-4eab-a1eb-d9d72a8ab2b4',
  },
  {
    name: 'Supporter',
    price: '$1200',
    features: [
      'Exclusive Content',
      'Vesting Opportunities',
      'Live Portfolio Analytics',
      'Profit Perks',
      'Personalized Support',
    ],
    info: 'Experience investment exclusivity with top-tier content and insights.',
    url: 'https://app.unlock-protocol.com/checkout?id=95ac51dd-67db-4b62-85c9-27dc393f9c04',
  },
  {
    name: 'Business',
    price: '$3000',
    features: [
      'Ad Privileges',
      'Ad Metrics',
      'Referral Rewards',
      'VIP Support',
    ],
    info: 'Amplify your business with advanced ad capabilities tailored for success.',
    url: 'https://app.unlock-protocol.com/checkout?id=0c0b9948-f155-445e-9485-96b8d8b6bc6a',
  },
];

export const ROLES = {
  sepolia: {
    test: {
      type: 'ERC721',
      chainId: 11155111,
      minToken: '1',
      contractAddress: '0xbc20b339c0dc2793ab4ecece98567f65632015b7',
      roleId: 'tester',
    },
  },
  polygon: {
    contributor: {
      type: 'ERC721',
      chainId: 137,
      minToken: '1',
      contractAddress: '0xb9c69af58109927cc2dcce8043f82158f7b96ca7',
      roleId: 'contributor',
    },
    creator: {
      type: 'ERC721',
      chainId: 137,
      minToken: '1',
      contractAddress: '0xb6b645c3e2025cf69983983266d16a0aa323e2b0',
      roleId: 'creator',
    },
    investor: {
      type: 'ERC721',
      chainId: 137,
      minToken: '1',
      contractAddress: '0xace23c0669bf52c50d30c33c7e4adc78cc8754ec',
      roleId: 'supporter',
    },
    brand: {
      type: 'ERC721',
      chainId: 137,
      minToken: '1',
      contractAddress: '0x480c5081793506ffb8e4a85390e4ac7c19f2d717',
      roleId: 'brand',
    },
    fan: {
      type: 'ERC721',
      chainId: 137,
      minToken: '1',
      contractAddress: '0xe174caa294999ec622988242641a27c11e6c22d8',
      roleId: 'fan',
    },
  },
};

export const ROLES_ABI = [
  {
    inputs: [],
    name: 'CANNOT_APPROVE_SELF',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CANT_BE_SMALLER_THAN_SUPPLY',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CANT_EXTEND_NON_EXPIRING_KEY',
    type: 'error',
  },
  {
    inputs: [],
    name: 'GAS_REFUND_FAILED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'INSUFFICIENT_ERC20_VALUE',
    type: 'error',
  },
  {
    inputs: [],
    name: 'INSUFFICIENT_VALUE',
    type: 'error',
  },
  {
    inputs: [],
    name: 'INVALID_ADDRESS',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'uint8',
        name: 'hookIndex',
        type: 'uint8',
      },
    ],
    name: 'INVALID_HOOK',
    type: 'error',
  },
  {
    inputs: [],
    name: 'INVALID_LENGTH',
    type: 'error',
  },
  {
    inputs: [],
    name: 'INVALID_TOKEN',
    type: 'error',
  },
  {
    inputs: [],
    name: 'KEY_NOT_VALID',
    type: 'error',
  },
  {
    inputs: [],
    name: 'KEY_TRANSFERS_DISABLED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'LOCK_HAS_CHANGED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'LOCK_SOLD_OUT',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MAX_KEYS_REACHED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'MIGRATION_REQUIRED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NON_COMPLIANT_ERC721_RECEIVER',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NON_RENEWABLE_LOCK',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NOT_ENOUGH_FUNDS',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NOT_ENOUGH_TIME',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NOT_READY_FOR_RENEWAL',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NO_SUCH_KEY',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NULL_VALUE',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ONLY_KEY_MANAGER_OR_APPROVED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ONLY_LOCK_MANAGER',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ONLY_LOCK_MANAGER_OR_KEY_GRANTER',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OUT_OF_RANGE',
    type: 'error',
  },
  {
    inputs: [],
    name: 'OWNER_CANT_BE_ADDRESS_ZERO',
    type: 'error',
  },
  {
    inputs: [],
    name: 'SCHEMA_VERSION_NOT_CORRECT',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TRANSFER_TO_SELF',
    type: 'error',
  },
  {
    inputs: [],
    name: 'TransferFailed',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UNAUTHORIZED',
    type: 'error',
  },
  {
    inputs: [],
    name: 'UNAUTHORIZED_KEY_MANAGER_UPDATE',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'approved',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'operator',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'approved',
        type: 'bool',
      },
    ],
    name: 'ApprovalForAll',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sendTo',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'refund',
        type: 'uint256',
      },
    ],
    name: 'CancelKey',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'onKeyPurchaseHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onKeyCancelHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onValidKeyHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onTokenURIHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onKeyTransferHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onKeyExtendHook',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'onKeyGrantHook',
        type: 'address',
      },
    ],
    name: 'EventHooksUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newExpiration',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'timeAdded',
        type: 'bool',
      },
    ],
    name: 'ExpirationChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'ExpireKey',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'refundValue',
        type: 'uint256',
      },
    ],
    name: 'GasRefundValueChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'receiver',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'refundedAmount',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
    ],
    name: 'GasRefunded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint8',
        name: 'version',
        type: 'uint8',
      },
    ],
    name: 'Initialized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'newTimestamp',
        type: 'uint256',
      },
    ],
    name: 'KeyExtended',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'KeyGranterAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'KeyGranterRemoved',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: '_newManager',
        type: 'address',
      },
    ],
    name: 'KeyManagerChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'updatedRecordsCount',
        type: 'uint256',
      },
    ],
    name: 'KeysMigrated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'expirationDuration',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxNumberOfKeys',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'maxKeysPerAcccount',
        type: 'uint256',
      },
    ],
    name: 'LockConfig',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'LockManagerAdded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'LockManagerRemoved',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'baseTokenURI',
        type: 'string',
      },
    ],
    name: 'LockMetadata',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'oldKeyPrice',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'keyPrice',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'oldTokenAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
    ],
    name: 'PricingChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'referrer',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'fee',
        type: 'uint256',
      },
    ],
    name: 'ReferrerFee',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'freeTrialLength',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'refundPenaltyBasisPoints',
        type: 'uint256',
      },
    ],
    name: 'RefundPenaltyChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'previousAdminRole',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'newAdminRole',
        type: 'bytes32',
      },
    ],
    name: 'RoleAdminChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleRevoked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: 'transferFeeBasisPoints',
        type: 'uint256',
      },
    ],
    name: 'TransferFeeChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'lockAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'unlockAddress',
        type: 'address',
      },
    ],
    name: 'UnlockCallFailed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'Withdrawal',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DEFAULT_ADMIN_ROLE',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'addLockManager',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_approved',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_keyOwner',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: 'balance',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'cancelAndRefund',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'expirationDuration',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'expireAndRefundFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_value',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_referrer',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: '_data',
        type: 'bytes',
      },
    ],
    name: 'extend',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'freeTrialLength',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'gasRefundValue',
    outputs: [
      {
        internalType: 'uint256',
        name: '_refundValue',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'getApproved',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'getCancelAndRefundValue',
    outputs: [
      {
        internalType: 'uint256',
        name: 'refund',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_keyOwner',
        type: 'address',
      },
    ],
    name: 'getHasValidKey',
    outputs: [
      {
        internalType: 'bool',
        name: 'isValid',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
    ],
    name: 'getRoleAdmin',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_time',
        type: 'uint256',
      },
    ],
    name: 'getTransferFee',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_duration',
        type: 'uint256',
      },
    ],
    name: 'grantKeyExtension',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address[]',
        name: '_recipients',
        type: 'address[]',
      },
      {
        internalType: 'uint256[]',
        name: '_expirationTimestamps',
        type: 'uint256[]',
      },
      {
        internalType: 'address[]',
        name: '_keyManagers',
        type: 'address[]',
      },
    ],
    name: 'grantKeys',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'hasRole',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address payable',
        name: '_lockCreator',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_expirationDuration',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_keyPrice',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxNumberOfKeys',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: '_lockName',
        type: 'string',
      },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_operator',
        type: 'address',
      },
    ],
    name: 'isApprovedForAll',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'isLockManager',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'isOwner',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_referrer',
        type: 'address',
      },
    ],
    name: 'isRenewable',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'isValidKey',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'keyExpirationTimestampFor',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    name: 'keyManagerOf',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'keyPrice',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'lendKey',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxKeysPerAddress',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxNumberOfKeys',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenIdFrom',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_tokenIdTo',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'mergeKeys',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    name: 'migrate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'numberOfOwners',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onKeyCancelHook',
    outputs: [
      {
        internalType: 'contract ILockKeyCancelHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onKeyExtendHook',
    outputs: [
      {
        internalType: 'contract ILockKeyExtendHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onKeyGrantHook',
    outputs: [
      {
        internalType: 'contract ILockKeyGrantHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onKeyPurchaseHook',
    outputs: [
      {
        internalType: 'contract ILockKeyPurchaseHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onKeyTransferHook',
    outputs: [
      {
        internalType: 'contract ILockKeyTransferHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onTokenURIHook',
    outputs: [
      {
        internalType: 'contract ILockTokenURIHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'onValidKeyHook',
    outputs: [
      {
        internalType: 'contract ILockValidKeyHook',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'ownerOf',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'publicLockVersion',
    outputs: [
      {
        internalType: 'uint16',
        name: '',
        type: 'uint16',
      },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256[]',
        name: '_values',
        type: 'uint256[]',
      },
      {
        internalType: 'address[]',
        name: '_recipients',
        type: 'address[]',
      },
      {
        internalType: 'address[]',
        name: '_referrers',
        type: 'address[]',
      },
      {
        internalType: 'address[]',
        name: '_keyManagers',
        type: 'address[]',
      },
      {
        internalType: 'bytes[]',
        name: '_data',
        type: 'bytes[]',
      },
    ],
    name: 'purchase',
    outputs: [
      {
        internalType: 'uint256[]',
        name: '',
        type: 'uint256[]',
      },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_referrer',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: '_data',
        type: 'bytes',
      },
    ],
    name: 'purchasePriceFor',
    outputs: [
      {
        internalType: 'uint256',
        name: 'minKeyPrice',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'referrerFees',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'refundPenaltyBasisPoints',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_referrer',
        type: 'address',
      },
    ],
    name: 'renewMembershipFor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceLockManager',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'renounceRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'role',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '_data',
        type: 'bytes',
      },
    ],
    name: 'safeTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'schemaVersion',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: '_approved',
        type: 'bool',
      },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_onKeyPurchaseHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onKeyCancelHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onValidKeyHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onTokenURIHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onKeyTransferHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onKeyExtendHook',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_onKeyGrantHook',
        type: 'address',
      },
    ],
    name: 'setEventHooks',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_refundValue',
        type: 'uint256',
      },
    ],
    name: 'setGasRefundValue',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_keyManager',
        type: 'address',
      },
    ],
    name: 'setKeyManagerOf',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'string',
        name: '_lockName',
        type: 'string',
      },
      {
        internalType: 'string',
        name: '_lockSymbol',
        type: 'string',
      },
      {
        internalType: 'string',
        name: '_baseTokenURI',
        type: 'string',
      },
    ],
    name: 'setLockMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'setOwner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_referrer',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_feeBasisPoint',
        type: 'uint256',
      },
    ],
    name: 'setReferrerFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenIdFrom',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_timeShared',
        type: 'uint256',
      },
    ],
    name: 'shareKey',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes4',
        name: 'interfaceId',
        type: 'bytes4',
      },
    ],
    name: 'supportsInterface',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenAddress',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_index',
        type: 'uint256',
      },
    ],
    name: 'tokenByIndex',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_keyOwner',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_index',
        type: 'uint256',
      },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'tokenURI',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_keyOwner',
        type: 'address',
      },
    ],
    name: 'totalKeys',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '_totalKeysCreated',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'transferFeeBasisPoints',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_from',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    name: 'unlendKey',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'unlockProtocol',
    outputs: [
      {
        internalType: 'contract IUnlock',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_keyPrice',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
    ],
    name: 'updateKeyPricing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_newExpirationDuration',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxNumberOfKeys',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_maxKeysPerAcccount',
        type: 'uint256',
      },
    ],
    name: 'updateLockConfig',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_freeTrialLength',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: '_refundPenaltyBasisPoints',
        type: 'uint256',
      },
    ],
    name: 'updateRefundPenalty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'updateSchemaVersion',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_transferFeeBasisPoints',
        type: 'uint256',
      },
    ],
    name: 'updateTransferFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenAddress',
        type: 'address',
      },
      {
        internalType: 'address payable',
        name: '_recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256',
      },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    stateMutability: 'payable',
    type: 'receive',
  },
];

// Contract Address object to encapsulate all contract related data
export const CONTRACT_ADDRESS = {
  gateway: {
    base: {
      erc20: '',
      erc721: '0xf7c4cd399395D80f9d61FDe833849106775269c6',
      erc1155: '',
    },
    abi: ROLES_ABI,
  },
  account: {
    factory: {
      address: {
        sepolia: ACCOUNT_FACTORY_ADDRESS.sepolia,
        polygon: ACCOUNT_FACTORY_ADDRESS.polygon,
      },
      abi: ACCOUNT_FACTORY_ABI,
    },
  },
  meToken: {
    factory: {
      address: {
        base: '0xb31Ae2583d983faa7D8C8304e6A16E414e721A0B',
      },
      abi: [],
    },
    token: {
      address: {
        base: '0xba5502db2aC2cBff189965e991C07109B14eB3f5',
      },
      abi: [],
    },
  },
  editionDrop: {
    erc1155: {
      baseSepolia: '0xbbC0bC56f44B744aC159311D9b46a819545F735B',
      amoy: '0xeB408a1A51179fE2E7C02e73df50432753374EEE',
      abi: [
        {
          inputs: [],
          stateMutability: 'nonpayable',
          type: 'constructor',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'index',
              type: 'uint256',
            },
          ],
          name: 'BatchMintInvalidBatchId',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
          ],
          name: 'BatchMintInvalidTokenId',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'batchId',
              type: 'uint256',
            },
          ],
          name: 'BatchMintMetadataFrozen',
          type: 'error',
        },
        {
          inputs: [],
          name: 'ContractMetadataUnauthorized',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'recipient',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'value',
              type: 'uint256',
            },
          ],
          name: 'CurrencyTransferLibFailedNativeTransfer',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'expected',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'actual',
              type: 'uint256',
            },
          ],
          name: 'DropClaimExceedLimit',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'expected',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'actual',
              type: 'uint256',
            },
          ],
          name: 'DropClaimExceedMaxSupply',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'expectedCurrency',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'expectedPricePerToken',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: 'actualCurrency',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'actualExpectedPricePerToken',
              type: 'uint256',
            },
          ],
          name: 'DropClaimInvalidTokenPrice',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'expected',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'actual',
              type: 'uint256',
            },
          ],
          name: 'DropClaimNotStarted',
          type: 'error',
        },
        {
          inputs: [],
          name: 'DropExceedMaxSupply',
          type: 'error',
        },
        {
          inputs: [],
          name: 'DropNoActiveCondition',
          type: 'error',
        },
        {
          inputs: [],
          name: 'DropUnauthorized',
          type: 'error',
        },
        {
          inputs: [],
          name: 'LazyMintInvalidAmount',
          type: 'error',
        },
        {
          inputs: [],
          name: 'LazyMintUnauthorized',
          type: 'error',
        },
        {
          inputs: [],
          name: 'OwnableUnauthorized',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
          ],
          name: 'PermissionsAlreadyGranted',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'expected',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'actual',
              type: 'address',
            },
          ],
          name: 'PermissionsInvalidPermission',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              internalType: 'bytes32',
              name: 'neededRole',
              type: 'bytes32',
            },
          ],
          name: 'PermissionsUnauthorizedAccount',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'max',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'actual',
              type: 'uint256',
            },
          ],
          name: 'PlatformFeeExceededMaxFeeBps',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'recipient',
              type: 'address',
            },
          ],
          name: 'PlatformFeeInvalidRecipient',
          type: 'error',
        },
        {
          inputs: [],
          name: 'PlatformFeeUnauthorized',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'recipient',
              type: 'address',
            },
          ],
          name: 'PrimarySaleInvalidRecipient',
          type: 'error',
        },
        {
          inputs: [],
          name: 'PrimarySaleUnauthorized',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'max',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'actual',
              type: 'uint256',
            },
          ],
          name: 'RoyaltyExceededMaxFeeBps',
          type: 'error',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'recipient',
              type: 'address',
            },
          ],
          name: 'RoyaltyInvalidRecipient',
          type: 'error',
        },
        {
          inputs: [],
          name: 'RoyaltyUnauthorized',
          type: 'error',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'operator',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'bool',
              name: 'approved',
              type: 'bool',
            },
          ],
          name: 'ApprovalForAll',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'uint256',
              name: '_fromTokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: '_toTokenId',
              type: 'uint256',
            },
          ],
          name: 'BatchMetadataUpdate',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'startTimestamp',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'maxClaimableSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'supplyClaimed',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'quantityLimitPerWallet',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes32',
                  name: 'merkleRoot',
                  type: 'bytes32',
                },
                {
                  internalType: 'uint256',
                  name: 'pricePerToken',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'currency',
                  type: 'address',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              indexed: false,
              internalType: 'struct IClaimCondition.ClaimCondition[]',
              name: 'claimConditions',
              type: 'tuple[]',
            },
            {
              indexed: false,
              internalType: 'bool',
              name: 'resetEligibility',
              type: 'bool',
            },
          ],
          name: 'ClaimConditionsUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'string',
              name: 'prevURI',
              type: 'string',
            },
            {
              indexed: false,
              internalType: 'string',
              name: 'newURI',
              type: 'string',
            },
          ],
          name: 'ContractURIUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'newRoyaltyRecipient',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'newRoyaltyBps',
              type: 'uint256',
            },
          ],
          name: 'DefaultRoyalty',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'address',
              name: 'platformFeeRecipient',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'flatFee',
              type: 'uint256',
            },
          ],
          name: 'FlatPlatformFeeUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'uint8',
              name: 'version',
              type: 'uint8',
            },
          ],
          name: 'Initialized',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'maxTotalSupply',
              type: 'uint256',
            },
          ],
          name: 'MaxTotalSupplyUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [],
          name: 'MetadataFrozen',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'prevOwner',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'newOwner',
              type: 'address',
            },
          ],
          name: 'OwnerUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'platformFeeRecipient',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'platformFeeBps',
              type: 'uint256',
            },
          ],
          name: 'PlatformFeeInfoUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'enum IPlatformFee.PlatformFeeType',
              name: 'feeType',
              type: 'uint8',
            },
          ],
          name: 'PlatformFeeTypeUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'recipient',
              type: 'address',
            },
          ],
          name: 'PrimarySaleRecipientUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              indexed: true,
              internalType: 'bytes32',
              name: 'previousAdminRole',
              type: 'bytes32',
            },
            {
              indexed: true,
              internalType: 'bytes32',
              name: 'newAdminRole',
              type: 'bytes32',
            },
          ],
          name: 'RoleAdminChanged',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'sender',
              type: 'address',
            },
          ],
          name: 'RoleGranted',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'sender',
              type: 'address',
            },
          ],
          name: 'RoleRevoked',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'royaltyRecipient',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'royaltyBps',
              type: 'uint256',
            },
          ],
          name: 'RoyaltyForToken',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'address',
              name: 'saleRecipient',
              type: 'address',
            },
          ],
          name: 'SaleRecipientForTokenUpdated',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'uint256',
              name: 'claimConditionIndex',
              type: 'uint256',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'claimer',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'receiver',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'quantityClaimed',
              type: 'uint256',
            },
          ],
          name: 'TokensClaimed',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'uint256',
              name: 'startTokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'endTokenId',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'string',
              name: 'baseURI',
              type: 'string',
            },
            {
              indexed: false,
              internalType: 'bytes',
              name: 'encryptedBaseURI',
              type: 'bytes',
            },
          ],
          name: 'TokensLazyMinted',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'operator',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'from',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'to',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256[]',
              name: 'ids',
              type: 'uint256[]',
            },
            {
              indexed: false,
              internalType: 'uint256[]',
              name: 'values',
              type: 'uint256[]',
            },
          ],
          name: 'TransferBatch',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: true,
              internalType: 'address',
              name: 'operator',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'from',
              type: 'address',
            },
            {
              indexed: true,
              internalType: 'address',
              name: 'to',
              type: 'address',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'id',
              type: 'uint256',
            },
            {
              indexed: false,
              internalType: 'uint256',
              name: 'value',
              type: 'uint256',
            },
          ],
          name: 'TransferSingle',
          type: 'event',
        },
        {
          anonymous: false,
          inputs: [
            {
              indexed: false,
              internalType: 'string',
              name: 'value',
              type: 'string',
            },
            {
              indexed: true,
              internalType: 'uint256',
              name: 'id',
              type: 'uint256',
            },
          ],
          name: 'URI',
          type: 'event',
        },
        {
          inputs: [],
          name: 'DEFAULT_ADMIN_ROLE',
          outputs: [
            {
              internalType: 'bytes32',
              name: '',
              type: 'bytes32',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'id',
              type: 'uint256',
            },
          ],
          name: 'balanceOf',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address[]',
              name: 'accounts',
              type: 'address[]',
            },
            {
              internalType: 'uint256[]',
              name: 'ids',
              type: 'uint256[]',
            },
          ],
          name: 'balanceOfBatch',
          outputs: [
            {
              internalType: 'uint256[]',
              name: '',
              type: 'uint256[]',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          name: 'batchFrozen',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: 'ids',
              type: 'uint256[]',
            },
            {
              internalType: 'uint256[]',
              name: 'values',
              type: 'uint256[]',
            },
          ],
          name: 'burnBatch',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_receiver',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_quantity',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_currency',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_pricePerToken',
              type: 'uint256',
            },
            {
              components: [
                {
                  internalType: 'bytes32[]',
                  name: 'proof',
                  type: 'bytes32[]',
                },
                {
                  internalType: 'uint256',
                  name: 'quantityLimitPerWallet',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'pricePerToken',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'currency',
                  type: 'address',
                },
              ],
              internalType: 'struct IDrop1155.AllowlistProof',
              name: '_allowlistProof',
              type: 'tuple',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'claim',
          outputs: [],
          stateMutability: 'payable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          name: 'claimCondition',
          outputs: [
            {
              internalType: 'uint256',
              name: 'currentStartId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'count',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'contractType',
          outputs: [
            {
              internalType: 'bytes32',
              name: '',
              type: 'bytes32',
            },
          ],
          stateMutability: 'pure',
          type: 'function',
        },
        {
          inputs: [],
          name: 'contractURI',
          outputs: [
            {
              internalType: 'string',
              name: '',
              type: 'string',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'contractVersion',
          outputs: [
            {
              internalType: 'uint8',
              name: '',
              type: 'uint8',
            },
          ],
          stateMutability: 'pure',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_index',
              type: 'uint256',
            },
          ],
          name: 'freezeBatchBaseURI',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
          ],
          name: 'getActiveClaimConditionId',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'getBaseURICount',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_index',
              type: 'uint256',
            },
          ],
          name: 'getBatchIdAtIndex',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_conditionId',
              type: 'uint256',
            },
          ],
          name: 'getClaimConditionById',
          outputs: [
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'startTimestamp',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'maxClaimableSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'supplyClaimed',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'quantityLimitPerWallet',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes32',
                  name: 'merkleRoot',
                  type: 'bytes32',
                },
                {
                  internalType: 'uint256',
                  name: 'pricePerToken',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'currency',
                  type: 'address',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct IClaimCondition.ClaimCondition',
              name: 'condition',
              type: 'tuple',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'getDefaultRoyaltyInfo',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
            {
              internalType: 'uint16',
              name: '',
              type: 'uint16',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'getFlatPlatformFeeInfo',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'getPlatformFeeInfo',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
            {
              internalType: 'uint16',
              name: '',
              type: 'uint16',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'getPlatformFeeType',
          outputs: [
            {
              internalType: 'enum IPlatformFee.PlatformFeeType',
              name: '',
              type: 'uint8',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
          ],
          name: 'getRoleAdmin',
          outputs: [
            {
              internalType: 'bytes32',
              name: '',
              type: 'bytes32',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'uint256',
              name: 'index',
              type: 'uint256',
            },
          ],
          name: 'getRoleMember',
          outputs: [
            {
              internalType: 'address',
              name: 'member',
              type: 'address',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
          ],
          name: 'getRoleMemberCount',
          outputs: [
            {
              internalType: 'uint256',
              name: 'count',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
          ],
          name: 'getRoyaltyInfoForToken',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
            {
              internalType: 'uint16',
              name: '',
              type: 'uint16',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_conditionId',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_claimer',
              type: 'address',
            },
          ],
          name: 'getSupplyClaimedByWallet',
          outputs: [
            {
              internalType: 'uint256',
              name: 'supplyClaimedByWallet',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
          ],
          name: 'grantRole',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
          ],
          name: 'hasRole',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
          ],
          name: 'hasRoleWithSwitch',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_defaultAdmin',
              type: 'address',
            },
            {
              internalType: 'string',
              name: '_name',
              type: 'string',
            },
            {
              internalType: 'string',
              name: '_symbol',
              type: 'string',
            },
            {
              internalType: 'string',
              name: '_contractURI',
              type: 'string',
            },
            {
              internalType: 'address[]',
              name: '_trustedForwarders',
              type: 'address[]',
            },
            {
              internalType: 'address',
              name: '_saleRecipient',
              type: 'address',
            },
            {
              internalType: 'address',
              name: '_royaltyRecipient',
              type: 'address',
            },
            {
              internalType: 'uint128',
              name: '_royaltyBps',
              type: 'uint128',
            },
            {
              internalType: 'uint128',
              name: '_platformFeeBps',
              type: 'uint128',
            },
            {
              internalType: 'address',
              name: '_platformFeeRecipient',
              type: 'address',
            },
          ],
          name: 'initialize',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'operator',
              type: 'address',
            },
          ],
          name: 'isApprovedForAll',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'forwarder',
              type: 'address',
            },
          ],
          name: 'isTrustedForwarder',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_amount',
              type: 'uint256',
            },
            {
              internalType: 'string',
              name: '_baseURIForTokens',
              type: 'string',
            },
            {
              internalType: 'bytes',
              name: '_data',
              type: 'bytes',
            },
          ],
          name: 'lazyMint',
          outputs: [
            {
              internalType: 'uint256',
              name: 'batchId',
              type: 'uint256',
            },
          ],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          name: 'maxTotalSupply',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes[]',
              name: 'data',
              type: 'bytes[]',
            },
          ],
          name: 'multicall',
          outputs: [
            {
              internalType: 'bytes[]',
              name: 'results',
              type: 'bytes[]',
            },
          ],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [],
          name: 'name',
          outputs: [
            {
              internalType: 'string',
              name: '',
              type: 'string',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'nextTokenIdToMint',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'owner',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'primarySaleRecipient',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
          ],
          name: 'renounceRole',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes32',
              name: 'role',
              type: 'bytes32',
            },
            {
              internalType: 'address',
              name: 'account',
              type: 'address',
            },
          ],
          name: 'revokeRole',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: 'tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'salePrice',
              type: 'uint256',
            },
          ],
          name: 'royaltyInfo',
          outputs: [
            {
              internalType: 'address',
              name: 'receiver',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'royaltyAmount',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'to',
              type: 'address',
            },
            {
              internalType: 'uint256[]',
              name: 'ids',
              type: 'uint256[]',
            },
            {
              internalType: 'uint256[]',
              name: 'amounts',
              type: 'uint256[]',
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes',
            },
          ],
          name: 'safeBatchTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'from',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'to',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'id',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'amount',
              type: 'uint256',
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes',
            },
          ],
          name: 'safeTransferFrom',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          name: 'saleRecipient',
          outputs: [
            {
              internalType: 'address',
              name: '',
              type: 'address',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'operator',
              type: 'address',
            },
            {
              internalType: 'bool',
              name: 'approved',
              type: 'bool',
            },
          ],
          name: 'setApprovalForAll',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              components: [
                {
                  internalType: 'uint256',
                  name: 'startTimestamp',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'maxClaimableSupply',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'supplyClaimed',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'quantityLimitPerWallet',
                  type: 'uint256',
                },
                {
                  internalType: 'bytes32',
                  name: 'merkleRoot',
                  type: 'bytes32',
                },
                {
                  internalType: 'uint256',
                  name: 'pricePerToken',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'currency',
                  type: 'address',
                },
                {
                  internalType: 'string',
                  name: 'metadata',
                  type: 'string',
                },
              ],
              internalType: 'struct IClaimCondition.ClaimCondition[]',
              name: '_conditions',
              type: 'tuple[]',
            },
            {
              internalType: 'bool',
              name: '_resetClaimEligibility',
              type: 'bool',
            },
          ],
          name: 'setClaimConditions',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'string',
              name: '_uri',
              type: 'string',
            },
          ],
          name: 'setContractURI',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_royaltyRecipient',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_royaltyBps',
              type: 'uint256',
            },
          ],
          name: 'setDefaultRoyaltyInfo',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_platformFeeRecipient',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_flatFee',
              type: 'uint256',
            },
          ],
          name: 'setFlatPlatformFeeInfo',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_maxTotalSupply',
              type: 'uint256',
            },
          ],
          name: 'setMaxTotalSupply',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_newOwner',
              type: 'address',
            },
          ],
          name: 'setOwner',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_platformFeeRecipient',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_platformFeeBps',
              type: 'uint256',
            },
          ],
          name: 'setPlatformFeeInfo',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'enum IPlatformFee.PlatformFeeType',
              name: '_feeType',
              type: 'uint8',
            },
          ],
          name: 'setPlatformFeeType',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: '_saleRecipient',
              type: 'address',
            },
          ],
          name: 'setPrimarySaleRecipient',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_recipient',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_bps',
              type: 'uint256',
            },
          ],
          name: 'setRoyaltyInfoForToken',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_saleRecipient',
              type: 'address',
            },
          ],
          name: 'setSaleRecipientForToken',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'bytes4',
              name: 'interfaceId',
              type: 'bytes4',
            },
          ],
          name: 'supportsInterface',
          outputs: [
            {
              internalType: 'bool',
              name: '',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [],
          name: 'symbol',
          outputs: [
            {
              internalType: 'string',
              name: '',
              type: 'string',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          name: 'totalSupply',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_index',
              type: 'uint256',
            },
            {
              internalType: 'string',
              name: '_uri',
              type: 'string',
            },
          ],
          name: 'updateBatchBaseURI',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
          ],
          name: 'uri',
          outputs: [
            {
              internalType: 'string',
              name: '',
              type: 'string',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'uint256',
              name: '_conditionId',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_claimer',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_tokenId',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: '_quantity',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: '_currency',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_pricePerToken',
              type: 'uint256',
            },
            {
              components: [
                {
                  internalType: 'bytes32[]',
                  name: 'proof',
                  type: 'bytes32[]',
                },
                {
                  internalType: 'uint256',
                  name: 'quantityLimitPerWallet',
                  type: 'uint256',
                },
                {
                  internalType: 'uint256',
                  name: 'pricePerToken',
                  type: 'uint256',
                },
                {
                  internalType: 'address',
                  name: 'currency',
                  type: 'address',
                },
              ],
              internalType: 'struct IDrop1155.AllowlistProof',
              name: '_allowlistProof',
              type: 'tuple',
            },
          ],
          name: 'verifyClaim',
          outputs: [
            {
              internalType: 'bool',
              name: 'isOverride',
              type: 'bool',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ],
    },
  },
};

// FOOTER
const currentYear = new Date().getFullYear();

export const FOOTER_LINKS = {
  whitepaper: 'https://creativeplatform.xyz/docs/resources/whitepaper',
  blog: 'https://blog.creativeplatform.xyz',
  about_us: 'https://creativeplatform.xyz/docs/intro',
  releases: 'https://creative-org-dao.canny.io/changelog',
  pricing: '/pricing',
  tutorial: 'https://crew3.xyz/c/thecreativedao/questboard',
  cookie_policy: 'https://creativeplatform.xyz/docs/cookie-policy',
  privacy_policy: 'https://creativeplatform.xyz/docs/privacy-policy',
  terms_and_conditions:
    'https://creativeplatform.xyz/docs/terms-and-conditions',
  status:
    'https://thecreative.grafana.net/public-dashboards/0d59c3754efd4cf5be8298ff3b24b685?orgId=1',
  terminal: 'https://app.creativeplatform.xyz',
};

export const SITE_COPYRIGHT = `© ${currentYear} Creative Organization DAO, LLC. All rights reserved.`;

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
};

// Profile.tsx
export const PFP = '/0.png';

export const PROFILE_VIDEOS = {
  tooltip: 'list of your uploaded videos',
  tooltip_position: 'bottom',
};

export const PROFILE_CAMPAIGNS = {
  tooltip: 'list of your campaigns',
  tooltip_position: 'bottom',
};

// Livepeer API
export const LIVEPEER_FULL_API_URL = 'https://livepeer.com/api';

// HERO
export const HERO_VIDEO_TITLE = 'Welcome To Creative Organization DAO';
export const LIVEPEER_HERO_PLAYBACK_ID = 'cbd1dw72qst9xmps';

// FEATURED VIDEO
export const FEATURED_VIDEO_TITLE = 'The Creative Podcast Episode 03';
export const LIVEPEER_FEATURED_PLAYBACK_ID = '5c2bzf537qbq0r7o';

// HERO SECTION
export const HERO_NAME = {
  top: 'Record Once,',
  bottom: 'Use Everywhere!',
};

export const HERO_DESCRIPTION = `${SITE_NAME} is a decentralized live streaming platform that puts you in control of your content and earnings. Get paid 100% of streaming revenue, have access to your own social token, and monetize your content into NFTs.`;

export const HERO_BUTTONS = {
  primary: {
    text: 'Get Started',
    href: 'https://app.unlock-protocol.com/checkout?id=bbbcff5f-835d-4fa3-9761-988d5da9da18',
  },
  secondary: {
    text: 'How It Works',
    href: 'https://creativeplatform.xyz/docs/intro',
    target: '_blank',
  },
};

export const HERO_IMAGE =
  'https://bafybeiefwmq6zykvyhwih5qbhucxrc34zbtxjbwboz7hdgkyh3u6p2ykfa.ipfs.nftstorage.link';

// FEATURED VIDEO
export const FEATURED_TEXT = {
  top: 'Record. Watch. Brand.',
  middle: 'Stream. Create. Inspire.',
  bottom: 'Engage. Dream. Earn.',
};

// URLS
export const API_BASE_URL = 'https://api.poap.tech';
export const APP_BASE_URL = 'https://app.poap.xyz';

// SPACE
export const SNAPSHOT_SPACE = 'thecreative.eth';

// STATES
export const NO_POAP = 'NO_POAP';
export const NOT_VOTED = 'NOT_VOTED';
export const LOADING = 'LOADING';
export const UNCLAIMED = 'UNCLAIMED';
export const CLAIMED = 'CLAIMED';

type State =
  | typeof NO_POAP
  | typeof NOT_VOTED
  | typeof LOADING
  | typeof UNCLAIMED
  | typeof CLAIMED;
type States = { [S in State]: Record<string, any> };
export const STATES: States = {
  NO_POAP: {
    header: "A POAP hasn't been setup for this proposal yet :'(",
    headerImage: 'https://snapshotsplugin.s3.us-west-2.amazonaws.com/empty.svg',
    mainImage:
      'https://snapshotsplugin.s3.us-west-2.amazonaws.com/placeholder.png',
  },
  NOT_VOTED: {
    headerImage: 'https://snapshotsplugin.s3.us-west-2.amazonaws.com/vote.svg',
    header: 'Vote to get this POAP',
    buttonText: 'Mint',
  },
  UNCLAIMED: {
    headerImage: 'https://snapshotsplugin.s3.us-west-2.amazonaws.com/claim.svg',
    header: 'Mint your I voted POAP',
    buttonText: 'Mint',
  },
  CLAIMED: {
    headerImage:
      'https://snapshotsplugin.s3.us-west-2.amazonaws.com/succes.svg',
    header: 'Congratulations! The POAP has been minted to your collection',
    buttonText: 'Browse collection',
  },
  LOADING: {
    headerImage:
      'https://snapshotsplugin.s3.us-west-2.amazonaws.com/succes.svg',
    header: 'The POAP is being minted to your collection',
    buttonText: '',
  },
};
