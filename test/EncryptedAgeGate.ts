// Updated: 2025-11-05 10:25:56
// Updated: 2025-11-02 16:53:18
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { EncryptedAgeGate, EncryptedAgeGate__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedAgeGate")) as EncryptedAgeGate__factory;
  const contract = (await factory.deploy()) as EncryptedAgeGate;
  const address = await contract.getAddress();

  return { contract, address };
}

async function encryptAge(
  contractAddress: string,
  user: HardhatEthersSigner,
  age: number,
) {
  return fhevm.createEncryptedInput(contractAddress, user.address).add8(age).encrypt();
}

async function decryptCount(
  contractAddress: string,
  handle: string,
  user: HardhatEthersSigner,
) {
  return fhevm.userDecryptEuint(FhevmType.euint32, handle, contractAddress, user);
}

describe("EncryptedAgeGate", function () {
  let signers: Signers;
  let contract: EncryptedAgeGate;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, address: contractAddress } = await deployFixture());
  });

  it("is uninitialized on deployment", async function () {
    const encryptedAge = await contract.getLatestAge(signers.alice.address);
    const encryptedDecision = await contract.getLatestDecision(signers.alice.address);
    const adultCount = await contract.getAdultSubmissions();

    expect(encryptedAge).to.eq(ethers.ZeroHash);
    expect(encryptedDecision).to.eq(ethers.ZeroHash);
    expect(adultCount).to.eq(ethers.ZeroHash);
  });

  it("accepts an adult submission and exposes decryptable stats", async function () {
    const encryptedAdultAge = await encryptAge(contractAddress, signers.alice, 21);
    const tx = await contract
      .connect(signers.alice)
      .submitAge(encryptedAdultAge.handles[0], encryptedAdultAge.inputProof);
    await tx.wait();

    const encryptedDecision = await contract.getLatestDecision(signers.alice.address);
    expect(encryptedDecision).to.not.eq(ethers.ZeroHash);

    const encryptedAdultCount = await contract.getAdultSubmissions();
    const clearAdultCount = await decryptCount(contractAddress, encryptedAdultCount, signers.alice);
    expect(clearAdultCount).to.eq(1);
  });

  it("tracks encrypted segments for adults and minors", async function () {
    const aliceAge = await encryptAge(contractAddress, signers.alice, 30);
    await (await contract.connect(signers.alice).submitAge(aliceAge.handles[0], aliceAge.inputProof)).wait();

    const bobAge = await encryptAge(contractAddress, signers.bob, 16);
    await (await contract.connect(signers.bob).submitAge(bobAge.handles[0], bobAge.inputProof)).wait();

    const adultCountEncrypted = await contract.getAdultSubmissions();
    const minorCountEncrypted = await contract.getMinorSubmissions();

    const adultCount = await decryptCount(contractAddress, adultCountEncrypted, signers.bob);
    const minorCount = await decryptCount(contractAddress, minorCountEncrypted, signers.bob);

    expect(adultCount).to.eq(1);
    expect(minorCount).to.eq(1);

    await (await contract.connect(signers.bob).allowStats(signers.alice.address)).wait();
    const adultCountForAlice = await decryptCount(contractAddress, adultCountEncrypted, signers.alice);
    expect(adultCountForAlice).to.eq(1);
  });
});
