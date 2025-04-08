import { createHash } from 'crypto';
import { createInterface } from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';

// Function to convert string to 32-byte hex
function stringToHex(input: string): string {
  const hash = createHash('sha256');
  hash.update(input);
  return hash.digest('hex'); // 64 chars (32 bytes) by default
}

// Create readline interface for prompting
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt user for input
function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Function to update .env file in project root
async function updateEnvFile(key: string, value: string): Promise<void> {
  const envFilePath = join(__dirname, '..', '.env'); // Assumes script is in a subdirectory like app/api/auth/utils
  let envContent = '';

  try {
    envContent = await fs.readFile(envFilePath, 'utf8').catch(() => '');
  } catch (error) {
    console.warn('No existing .env file found at project root, creating a new one.');
  }

  const lines = envContent.split('\n').filter(Boolean);
  const keyExists = lines.some((line) => line.startsWith(`${key}=`));
  if (keyExists) {
    const updatedLines = lines.map((line) =>
      line.startsWith(`${key}=`) ? `${key}=${value}` : line
    );
    envContent = updatedLines.join('\n');
  } else {
    envContent = `${envContent}\n${key}=${value}`.trim();
  }

  await fs.writeFile(envFilePath, envContent, 'utf8');
}

// Main logic
async function updateEnvironmentVariables() {
  // Environment variables with fallback to empty string if undefined
  let thirdWebSecretKey = process.env.THIRDWEB_SECRET_KEY ?? '';
  let thirdWebAdminPrivateKey = process.env.THIRDWEB_ADMIN_PRIVATE_KEY ?? '';
  let livepeerFullApiKey = process.env.LIVEPEER_FULL_API_KEY ?? '';

  // Check for missing variables and prompt user
  const missingVars: string[] = [];
  if (!thirdWebSecretKey) missingVars.push('THIRDWEB_SECRET_KEY');
  if (!thirdWebAdminPrivateKey) missingVars.push('THIRDWEB_ADMIN_PRIVATE_KEY');
  if (!livepeerFullApiKey) missingVars.push('LIVEPEER_FULL_API_KEY');

  if (missingVars.length > 0) {
    console.log(`The following environment variables are missing: ${missingVars.join(', ')}`);
    for (const missingVar of missingVars) {
      const userInput = await promptUser(`Enter value for ${missingVar}: `);
      const hexValue = missingVar === 'THIRDWEB_ADMIN_PRIVATE_KEY' ? `0x${stringToHex(userInput)}` : stringToHex(userInput);
      await updateEnvFile(missingVar, hexValue);
      process.env[missingVar] = hexValue; // Update in memory
    }
  }

  // Reload updated values with fallback
  thirdWebSecretKey = process.env.THIRDWEB_SECRET_KEY ?? '';
  thirdWebAdminPrivateKey = process.env.THIRDWEB_ADMIN_PRIVATE_KEY ?? '';
  livepeerFullApiKey = process.env.LIVEPEER_FULL_API_KEY ?? '';

  try {
    // Convert to 32-byte hex
    const secretKeyHex = stringToHex(thirdWebSecretKey);
    const adminPrivateKeyHex = thirdWebAdminPrivateKey.startsWith('0x') ? thirdWebAdminPrivateKey : `0x${stringToHex(thirdWebAdminPrivateKey)}`;
    const livepeerFullApiKeyHex = stringToHex(livepeerFullApiKey);

    // Update environment variables (in memory and file)
    await updateEnvFile('THIRDWEB_SECRET_KEY', secretKeyHex);
    await updateEnvFile('THIRDWEB_ADMIN_PRIVATE_KEY', adminPrivateKeyHex);
    await updateEnvFile('LIVEPEER_FULL_API_KEY', livepeerFullApiKeyHex);

    process.env.THIRDWEB_SECRET_KEY = secretKeyHex;
    process.env.THIRDWEB_ADMIN_PRIVATE_KEY = adminPrivateKeyHex;
    process.env.LIVEPEER_FULL_API_KEY = livepeerFullApiKeyHex;

    // Log the updated hex values to the terminal
    console.log('Updated Environment Variables:');
    console.log(`THIRDWEB_SECRET_KEY: ${secretKeyHex}`);
    console.log(`THIRDWEB_ADMIN_PRIVATE_KEY: ${adminPrivateKeyHex}`);
    console.log(`LIVEPEER_FULL_API_KEY: ${livepeerFullApiKeyHex}`);
  } catch (error: unknown) {
    console.error('Error processing environment variables:', (error as Error).message);
    throw error;
  } finally {
    rl.close();
  }
}

// Execute the function
updateEnvironmentVariables().catch((err) => {
  console.error('Failed to update environment variables:', err);
  process.exit(1);
});