import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the FHECounter contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the FHECounter contract
 *
 *   npx hardhat --network localhost task:decrypt-count
 *   npx hardhat --network localhost task:increment --value 2
 *   npx hardhat --network localhost task:decrement --value 1
 *   npx hardhat --network localhost task:decrypt-count
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the FHECounter contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the FHECounter contract
 *
 *   npx hardhat --network sepolia task:decrypt-count
 *   npx hardhat --network sepolia task:increment --value 2
 *   npx hardhat --network sepolia task:decrement --value 1
 *   npx hardhat --network sepolia task:decrypt-count
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the EncryptedAgeGate address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const ageGate = await deployments.get("EncryptedAgeGate");

  console.log("EncryptedAgeGate address is " + ageGate.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:decrypt-count
 *   - npx hardhat --network sepolia task:decrypt-count
 */
task("task:decrypt-age", "Decrypts the latest decision for the caller")
  .addOptionalParam("address", "Optionally specify the EncryptedAgeGate contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const encryptedAgeGateDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedAgeGate");
    console.log(`EncryptedAgeGate: ${encryptedAgeGateDeployment.address}`);

    const signers = await ethers.getSigners();

    const encryptedAgeGateContract = await ethers.getContractAt("EncryptedAgeGate", encryptedAgeGateDeployment.address);

    const encryptedDecision = await encryptedAgeGateContract.getLatestDecision(signers[0].address);
    if (encryptedDecision === ethers.ZeroHash) {
      console.log(`encrypted decision: ${encryptedDecision}`);
      console.log("clear decision    : No submission yet");
    } else {
      const clearDecision = await fhevm.userDecryptEbool(
        encryptedDecision,
        encryptedAgeGateDeployment.address,
        signers[0]
      );
      console.log(`encrypted decision: ${encryptedDecision}`);
      console.log(`clear decision    : ${clearDecision ? "Adult" : "Minor"}`);
    }

    const encryptedAdultCount = await encryptedAgeGateContract.getAdultSubmissions();
    if (encryptedAdultCount !== ethers.ZeroHash) {
      const clearAdultCount = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        encryptedAdultCount,
        encryptedAgeGateDeployment.address,
        signers[0]
      );
      console.log(`adult submissions : ${clearAdultCount}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:increment --value 1
 *   - npx hardhat --network sepolia task:increment --value 1
 */
task("task:submit-age", "Encrypts an age and submits it to the EncryptedAgeGate contract")
  .addOptionalParam("address", "Optionally specify the EncryptedAgeGate contract address")
  .addParam("value", "The age value in years")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const value = parseInt(taskArguments.value);
    if (!Number.isInteger(value)) {
      throw new Error(`Argument --value is not an integer`);
    }

    await fhevm.initializeCLIApi();

    const encryptedAgeGateDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedAgeGate");
    console.log(`EncryptedAgeGate: ${encryptedAgeGateDeployment.address}`);

    const signers = await ethers.getSigners();

    const encryptedAgeGateContract = await ethers.getContractAt("EncryptedAgeGate", encryptedAgeGateDeployment.address);

    const encryptedValue = await fhevm
      .createEncryptedInput(encryptedAgeGateDeployment.address, signers[0].address)
      .add8(value)
      .encrypt();

    const tx = await encryptedAgeGateContract
      .connect(signers[0])
      .submitAge(encryptedValue.handles[0], encryptedValue.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const encryptedDecision = await encryptedAgeGateContract.getLatestDecision(signers[0].address);
    console.log("Encrypted decision handle:", encryptedDecision);

    console.log(`EncryptedAgeGate submitAge(${value}) succeeded!`);
  });

task("task:allow-stats", "Grant stats decryption rights to a viewer address")
  .addOptionalParam("address", "Optionally specify the EncryptedAgeGate contract address")
  .addParam("viewer", "Viewer address to authorize")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const viewer = taskArguments.viewer;
    if (!ethers.isAddress(viewer)) {
      throw new Error("viewer must be a valid address");
    }

    const encryptedAgeGateDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("EncryptedAgeGate");

    const contract = await ethers.getContractAt("EncryptedAgeGate", encryptedAgeGateDeployment.address);
    const tx = await contract.allowStats(viewer);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
    console.log(`Authorized stats access for ${viewer}`);
  });
