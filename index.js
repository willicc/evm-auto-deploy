require('dotenv').config();
require('colors');
const {
  loadNetworkConfig,
  displayHeader,
  delay,
} = require('./src/utils');
const { deployContract } = require('./src/deploy');
const readlineSync = require('readline-sync');
const crypto = require('crypto');

async function main() {
  displayHeader();
  console.log(`Please wait...\n`.yellow);
  await delay(1000);

  console.log('Welcome to EVM Auto Deploy!'.green.bold);

  // Ambil network type dari argumen CLI (misal: node main.js testnet)
  const networkType = process.argv[2] || 'testnet';
  const networks = loadNetworkConfig(networkType);

  if (!Array.isArray(networks) || networks.length === 0) {
    console.error('No networks found in config for type:'.red, networkType);
    process.exit(1);
  }

  console.log(`Available networks:`.yellow);
  networks.forEach((network, index) => {
    console.log(`${index + 1}. ${network.name}`);
  });

  const networkIndexInput = readlineSync.question(
    '\nSelect a network (enter number): '.cyan
  );
  const networkIndex = parseInt(networkIndexInput) - 1;
  const selectedNetwork = networks[networkIndex];
  if (!selectedNetwork) {
    console.error('Invalid network selection'.red);
    process.exit(1);
  }

  // Tentukan berapa kali deploy; bisa lewat argumen ketiga, misal: node main.js testnet 100
  let deployCount = parseInt(process.argv[3]);
  if (isNaN(deployCount) || deployCount <= 0) {
    // Prompt interaktif
    deployCount = readlineSync.questionInt(
      'How many tokens do you want to deploy? (e.g., 100): '.cyan,
      { limitMessage: 'Please enter a positive integer.' }
    );
  }
  console.log(`Will deploy ${deployCount} tokens sequentially.`.yellow);

  // Opsi: tanyakan rentang supply
  let minSupply = parseInt(process.argv[4]);
  let maxSupply = parseInt(process.argv[5]);
  if (
    isNaN(minSupply) ||
    isNaN(maxSupply) ||
    minSupply <= 0 ||
    maxSupply <= 0 ||
    minSupply > maxSupply
  ) {
    console.log(
      'Please specify supply range for random generation.'.cyan
    );
    minSupply = readlineSync.questionInt(
      'Enter minimum supply (integer > 0): '.cyan,
      { limitMessage: 'Please enter a positive integer.' }
    );
    maxSupply = readlineSync.questionInt(
      `Enter maximum supply (integer >= ${minSupply}): `.cyan,
      {
        limitMessage: `Please enter an integer >= ${minSupply}.`,
        limit: (input) => {
          const v = parseInt(input);
          return !isNaN(v) && v >= minSupply;
        },
      }
    );
  }
  console.log(
    `Supply will be random between ${minSupply} and ${maxSupply} (inclusive).`.yellow
  );

  // Fungsi untuk generate random name, symbol, supply
  function generateRandomName() {
    // Contoh: "Token" + 6 hex chars
    const suffix = crypto.randomBytes(3).toString('hex');
    return `Token${suffix}`;
  }
  function generateRandomSymbol() {
    // Generate 3-5 huruf kapital acak
    const length = Math.floor(Math.random() * 3) + 3; // 3,4,5
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let sym = '';
    for (let i = 0; i < length; i++) {
      sym += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return sym;
  }
  function generateRandomSupply() {
    // integer antara minSupply dan maxSupply
    const range = maxSupply - minSupply + 1;
    const rnd = Math.floor(Math.random() * range) + minSupply;
    return rnd.toString(); // kembalikan string
  }

  console.log('\nStarting deployments...\n'.green);
  const results = [];
  for (let i = 0; i < deployCount; i++) {
    const name = generateRandomName();
    const symbol = generateRandomSymbol();
    const supply = generateRandomSupply();
    console.log(
      `Deploy #${i + 1}/${deployCount}: name=${name}, symbol=${symbol}, supply=${supply}`
        .cyan
    );

    try {
      const contractAddress = await deployContract(
        selectedNetwork,
        name,
        symbol,
        supply
      );
      console.log(
        `  -> Success! Contract deployed at ${contractAddress}`.green
      );
      results.push({ name, symbol, supply, address: contractAddress });
    } catch (err) {
      console.error(
        `  -> Failed on deploy #${i + 1}: ${err.message}`.red
      );
      results.push({ name, symbol, supply, address: null, error: err.message });
      // Tergantung kebutuhan: Anda bisa break; jika ingin berhenti pada error, atau lanjut.
      // Berikut ini kita lanjut supaya tetap mencoba sisanya.
    }

    // Opsional: delay singkat agar tidak mem-blast transaksi terlalu cepat
    await delay(1000);
  }

  console.log('\nAll done. Summary:\n'.bold);
  results.forEach((res, idx) => {
    if (res.address) {
      console.log(
        `#${idx + 1}: name=${res.name}, symbol=${res.symbol}, supply=${res.supply} -> ${res.address}`
          .green
      );
    } else {
      console.log(
        `#${idx + 1}: name=${res.name}, symbol=${res.symbol}, supply=${res.supply} -> FAILED (${res.error})`
          .red
      );
    }
  });

  // Jika ingin menyimpan summary ke file JSON:
  const fs = require('fs');
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
  const summaryFile = `deploy-summary-${timestamp}.json`;
  try {
    fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
    console.log(`\nSummary saved to ${summaryFile}`.yellow);
  } catch (e) {
    console.error('Failed to write summary file:'.red, e.message);
  }

  console.log('\nDone.'.green.bold);
}

main().catch((error) => {
  console.error('Fatal error:'.red, error);
  process.exit(1);
});
