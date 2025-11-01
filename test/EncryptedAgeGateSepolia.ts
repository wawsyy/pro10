import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm, deployments } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { EncryptedAgeGate } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("EncryptedAgeGateSepolia", function () {
  let signers: Signers;
  let ageGateContract: EncryptedAgeGate;
  let ageGateAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("EncryptedAgeGate");
      ageGateAddress = deployment.address;
      ageGateContract = await ethers.getContractAt("EncryptedAgeGate", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("processes an encrypted submission", async function () {
    steps = 8;

    this.timeout(4 * 40000);

    progress("Encrypting age '22'...");
    const encryptedAge = await fhevm
      .createEncryptedInput(ageGateAddress, signers.alice.address)
      .add8(22)
      .encrypt();

    progress(
      `Call submitAge(22) contract=${ageGateAddress} handle=${ethers.hexlify(encryptedAge.handles[0])} signer=${signers.alice.address}...`,
    );
    const tx = await ageGateContract
      .connect(signers.alice)
      .submitAge(encryptedAge.handles[0], encryptedAge.inputProof);
    await tx.wait();

    progress(`Call EncryptedAgeGate.getLatestDecision(${signers.alice.address})...`);
    const encryptedDecision = await ageGateContract.getLatestDecision(signers.alice.address);
    expect(encryptedDecision).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting decision handle=${encryptedDecision}...`);
    const clearDecision = await fhevm.userDecryptEbool(
      FhevmType.ebool,
      encryptedDecision,
      ageGateAddress,
      signers.alice,
    );
    progress(`Clear decision=${clearDecision}`);

    expect(clearDecision).to.eq(true);
  });
});
