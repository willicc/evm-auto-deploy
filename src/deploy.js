require('colors');
const ethers = require('ethers');
const { generateContractCode } = require('./contractCode');

async function deployContract(network, name, symbol, supply) {
  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log(`\nDeploying contract to ${network.name}...`.yellow);

    const { bytecode, abi } = generateContractCode(name, symbol, supply);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    // Deploy tanpa constructor args? Misal generateContractCode meng-embed constructor.
    const contract = await factory.deploy();
    // Tunggu hingga deployment ter-mined (jika ethers v5: await contract.deployed(); 
    // jika ethers v6, bisa await contract.waitForDeployment())
    try {
      if (typeof contract.waitForDeployment === 'function') {
        await contract.waitForDeployment();
      } else if (typeof contract.deployed === 'function') {
        await contract.deployed();
      } else {
        // Jika tidak tersedia, setidaknya tunggu beberapa detik (fallback)
        await new Promise((res) => setTimeout(res, 5000));
      }
    } catch (e) {
      console.warn('Warning: error or timeout waiting for deployment:', e.message);
    }

    // Alamat kontrak di ethers v6: contract.target; di ethers v5: contract.address
    const address =
      contract.target || contract.address || (contract.address && contract.address);

    console.log(`\nContract deployed successfully!`.green);
    console.log(`Contract address: ${address}`.cyan);
    console.log(
      `Explorer URL: ${network.explorer}/address/${address}`.blue
    );

    return address;
  } catch (error) {
    console.error(`Error deploying contract: ${error.message}`.red);
    throw error; // jangan exit di sini agar loop di main dapat menanganinya
  }
}

module.exports = { deployContract };
