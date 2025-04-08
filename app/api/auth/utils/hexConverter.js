"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_1 = require("crypto");
var readline_1 = require("readline");
var fs_1 = require("fs");
// Function to convert string to 32-byte hex
function stringToHex(input) {
    var hash = (0, crypto_1.createHash)('sha256');
    hash.update(input);
    return hash.digest('hex'); // 64 chars (32 bytes) by default
}
// Create readline interface for prompting
var rl = (0, readline_1.createInterface)({
    input: process.stdin,
    output: process.stdout,
});
// Function to prompt user for input
function promptUser(question) {
    return new Promise(function (resolve) {
        rl.question(question, function (answer) {
            resolve(answer.trim());
        });
    });
}
// Function to update .env file
function updateEnvFile(key, value) {
    return __awaiter(this, void 0, void 0, function () {
        var envFilePath, envContent, error_1, lines, keyExists, updatedLines;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    envFilePath = '.env';
                    envContent = '';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fs_1.promises.readFile(envFilePath, 'utf8').catch(function () { return ''; })];
                case 2:
                    envContent = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.warn('No existing .env file found, creating a new one.');
                    return [3 /*break*/, 4];
                case 4:
                    lines = envContent.split('\n').filter(Boolean);
                    keyExists = lines.some(function (line) { return line.startsWith("".concat(key, "=")); });
                    if (keyExists) {
                        updatedLines = lines.map(function (line) {
                            return line.startsWith("".concat(key, "=")) ? "".concat(key, "=").concat(value) : line;
                        });
                        envContent = updatedLines.join('\n');
                    }
                    else {
                        envContent = "".concat(envContent, "\n").concat(key, "=").concat(value).trim();
                    }
                    return [4 /*yield*/, fs_1.promises.writeFile(envFilePath, envContent, 'utf8')];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Main logic
function updateEnvironmentVariables() {
    return __awaiter(this, void 0, void 0, function () {
        var thirdWebSecretKey, thirdWebAdminPrivateKey, livepeerFullApiKey, missingVars, _i, missingVars_1, missingVar, userInput, hexValue, secretKeyHex, adminPrivateKeyHex, livepeerFullApiKeyHex, error_2;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    thirdWebSecretKey = (_a = process.env.THIRDWEB_SECRET_KEY) !== null && _a !== void 0 ? _a : '';
                    thirdWebAdminPrivateKey = (_b = process.env.THIRDWEB_ADMIN_PRIVATE_KEY) !== null && _b !== void 0 ? _b : '';
                    livepeerFullApiKey = (_c = process.env.LIVEPEER_FULL_API_KEY) !== null && _c !== void 0 ? _c : '';
                    missingVars = [];
                    if (!thirdWebSecretKey)
                        missingVars.push('THIRDWEB_SECRET_KEY');
                    if (!thirdWebAdminPrivateKey)
                        missingVars.push('THIRDWEB_ADMIN_PRIVATE_KEY');
                    if (!livepeerFullApiKey)
                        missingVars.push('LIVEPEER_FULL_API_KEY');
                    if (!(missingVars.length > 0)) return [3 /*break*/, 5];
                    console.log("The following environment variables are missing: ".concat(missingVars.join(', ')));
                    _i = 0, missingVars_1 = missingVars;
                    _g.label = 1;
                case 1:
                    if (!(_i < missingVars_1.length)) return [3 /*break*/, 5];
                    missingVar = missingVars_1[_i];
                    return [4 /*yield*/, promptUser("Enter value for ".concat(missingVar, ": "))];
                case 2:
                    userInput = _g.sent();
                    hexValue = missingVar === 'THIRDWEB_ADMIN_PRIVATE_KEY' ? "0x".concat(stringToHex(userInput)) : stringToHex(userInput);
                    return [4 /*yield*/, updateEnvFile(missingVar, hexValue)];
                case 3:
                    _g.sent();
                    process.env[missingVar] = hexValue; // Update in memory
                    _g.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 1];
                case 5:
                    // Reload updated values with fallback
                    thirdWebSecretKey = (_d = process.env.THIRDWEB_SECRET_KEY) !== null && _d !== void 0 ? _d : '';
                    thirdWebAdminPrivateKey = (_e = process.env.THIRDWEB_ADMIN_PRIVATE_KEY) !== null && _e !== void 0 ? _e : '';
                    livepeerFullApiKey = (_f = process.env.LIVEPEER_FULL_API_KEY) !== null && _f !== void 0 ? _f : '';
                    _g.label = 6;
                case 6:
                    _g.trys.push([6, 10, 11, 12]);
                    secretKeyHex = stringToHex(thirdWebSecretKey);
                    adminPrivateKeyHex = thirdWebAdminPrivateKey.startsWith('0x') ? thirdWebAdminPrivateKey : "0x".concat(stringToHex(thirdWebAdminPrivateKey));
                    livepeerFullApiKeyHex = stringToHex(livepeerFullApiKey);
                    // Update environment variables (in memory and file)
                    return [4 /*yield*/, updateEnvFile('THIRDWEB_SECRET_KEY', secretKeyHex)];
                case 7:
                    // Update environment variables (in memory and file)
                    _g.sent();
                    return [4 /*yield*/, updateEnvFile('THIRDWEB_ADMIN_PRIVATE_KEY', adminPrivateKeyHex)];
                case 8:
                    _g.sent();
                    return [4 /*yield*/, updateEnvFile('LIVEPEER_FULL_API_KEY', livepeerFullApiKeyHex)];
                case 9:
                    _g.sent();
                    process.env.THIRDWEB_SECRET_KEY = secretKeyHex;
                    process.env.THIRDWEB_ADMIN_PRIVATE_KEY = adminPrivateKeyHex;
                    process.env.LIVEPEER_FULL_API_KEY = livepeerFullApiKeyHex;
                    // Log the updated hex values to the terminal
                    console.log('Updated Environment Variables:');
                    console.log("THIRDWEB_SECRET_KEY: ".concat(secretKeyHex));
                    console.log("THIRDWEB_ADMIN_PRIVATE_KEY: ".concat(adminPrivateKeyHex));
                    console.log("LIVEPEER_FULL_API_KEY: ".concat(livepeerFullApiKeyHex));
                    return [3 /*break*/, 12];
                case 10:
                    error_2 = _g.sent();
                    console.error('Error processing environment variables:', error_2.message);
                    throw error_2;
                case 11:
                    rl.close();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
// Execute the function
updateEnvironmentVariables().catch(function (err) {
    console.error('Failed to update environment variables:', err);
    process.exit(1);
});
