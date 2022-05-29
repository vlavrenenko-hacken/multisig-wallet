import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  MultiSigWallet__factory,
  MultiSigWallet,
  TestContract,
  TestContract__factory,
} from "../typechain-types"

describe("MultiSigWallet Test", function () {
  let signers: SignerWithAddress[];
  let owners: string[];
  let ownerAddress: string;
  let multiSigWallet: MultiSigWallet;
  let testContract: TestContract;
  let numConfirmationsRequired: number;
  beforeEach(async () => {
    numConfirmationsRequired = 3;
    signers = await ethers.getSigners();
    owners = [signers[0].address, signers[1].address, signers[2].address];
    ownerAddress = signers[0].address;
    multiSigWallet = await new MultiSigWallet__factory(signers[0]).deploy(
      owners,
      numConfirmationsRequired
    );
    testContract = await new TestContract__factory(signers[0]).deploy();
  });

  it("Should create a MutliSig Wallet with the correct state", async function () {
    const ownersNumber = owners.length;
    expect((await multiSigWallet.getOwners()).length).to.eq(ownersNumber);
    expect(await multiSigWallet.numConfirmationsRequired()).to.eq(
      numConfirmationsRequired
    );
  });

  // SUBMIT A TRANSACTION
  it("Should submit a tx successfully", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    expect(
      await multiSigWallet.connect(signers[0]).getTransactionCount()
    ).to.eq(1);
  });

  it("Can't submit a tx with invalid data", async function () {
    const to = testContract.address;
    const value = 0;
    const data = ethers.utils.toUtf8Bytes("");

    await expect(
      multiSigWallet.connect(signers[0]).submitTransaction(to, value, data)
    ).to.be.revertedWith("invalid tx data");
  });

  it("Can't submit a tx from a non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();

    await expect(
      multiSigWallet.connect(signers[3]).submitTransaction(to, value, data)
    ).to.be.revertedWith("not owner");
  });

  it("Should emit SubmitTransaction when a tx has been submitted", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await expect(
      multiSigWallet.connect(signers[0]).submitTransaction(to, value, data)
    )
      .to.emit(multiSigWallet, "SubmitTransaction")
      .withArgs(ownerAddress, txIndex, to, value, data);
  });

  // CONFIRM A TRANSACTION
  it("Should confirm a tx", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    expect(await multiSigWallet.numConfirmationsRequired()).to.eq(
      numConfirmationsRequired
    );
  });

  it("Can't confirm a tx from a non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;
    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await expect(
      multiSigWallet.connect(signers[3]).confirmTransaction(txIndex)
    ).to.be.revertedWith("not owner");
  });

  it("Should emit ConfirmTransaction", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;
    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await expect(
      multiSigWallet.connect(signers[0]).confirmTransaction(txIndex)
    ).to.emit(multiSigWallet, "ConfirmTransaction");
  });

  it("Can't confirm the transaction that doesn't exist", async function () {
    const txIndex = 1;
    await expect(
      multiSigWallet.connect(signers[0]).confirmTransaction(txIndex)
    ).to.be.revertedWith("tx does not exist");
  });

  it("Can't confirm the transaction that has already been executed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const txIndex = 0;
    const data = await testContract.getData();
    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await multiSigWallet.connect(signers[0]).executeTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[0]).confirmTransaction(txIndex)
    ).to.be.revertedWith("tx already executed");
  });

  it("Can't confirm the transaction that has been confirmed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    await expect(
      multiSigWallet.connect(signers[0]).confirmTransaction(txIndex)
    ).to.be.revertedWith("tx already confirmed");
  });

  // EXECUTE A TRANSACTION
  it("Should execute a tx", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    expect(await multiSigWallet.getTransactionCount()).to.eq(1);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await multiSigWallet.connect(signers[0]).executeTransaction(txIndex);
    expect(await ethers.provider.getBalance(to)).to.eq(value);
  });

  it("Can't execute a tx from a non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await expect(
      multiSigWallet.connect(signers[3]).executeTransaction(txIndex)
    ).to.be.revertedWith("not owner");
  });

  it("Can't execute a tx with not enough confirmations", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await expect(
      multiSigWallet.connect(signers[0]).executeTransaction(txIndex)
    ).to.be.revertedWith("not confirmed");
  });

  it("Should emit ExecuteTransaction when the tx's been executed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await expect(
      multiSigWallet.connect(signers[2]).executeTransaction(txIndex)
    ).to.emit(multiSigWallet, "ExecuteTransaction");
  });

  it("Can't execute a tx that doesn't exist", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;
    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await expect(
      multiSigWallet.connect(signers[0]).executeTransaction(1)
    ).to.be.revertedWith("tx does not exist");
  });

  it("Can't execute the tx that has already been executed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await multiSigWallet.connect(signers[0]).executeTransaction(txIndex);
    await expect(
      multiSigWallet.connect(signers[0]).executeTransaction(txIndex)
    ).to.be.revertedWith("tx already executed");
  });

  // CHANGE A TRANSACTION
  it("Should change a transaction", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    const value1 = ethers.utils.parseEther("2");
    await multiSigWallet
      .connect(signers[0])
      .changeTransaction(txIndex, to, value1, data);
    expect((await multiSigWallet.getTransaction(txIndex)).value).to.eq(value1);
    expect(
      (await multiSigWallet.getTransaction(txIndex)).numConfirmations
    ).to.eq(0);
  });

  it("Can't change the transaction from the non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    const value1 = ethers.utils.parseEther("2");
    await expect(
      multiSigWallet
        .connect(signers[3])
        .changeTransaction(txIndex, to, value1, data)
    ).to.be.revertedWith("not owner");
  });

  it("Can't change the transaction that doesn't exist", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;
    await expect(
      multiSigWallet
        .connect(signers[0])
        .changeTransaction(txIndex, to, value, data)
    ).to.be.revertedWith("tx does not exist");
  });

  it("Can't change the transaction that's been already executed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });

    await multiSigWallet.connect(signers[0]).executeTransaction(txIndex);

    const value1 = ethers.utils.parseEther("1");
    await expect(
      multiSigWallet
        .connect(signers[0])
        .changeTransaction(txIndex, to, value1, data)
    ).to.be.revertedWith("tx already executed");
  });

  it("Should emit ChangeTransaction when the tx's been changed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    const value1 = ethers.utils.parseEther("2");
    await expect(
      await multiSigWallet
        .connect(signers[0])
        .changeTransaction(txIndex, to, value1, data)
    ).to.emit(multiSigWallet, "ChangeTransaction");
  });
  it("Can't change a tx with invalid data", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = ethers.utils.toUtf8Bytes("");
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);
    const value1 = 0;
    const data1 = ethers.utils.toUtf8Bytes("");
    await expect(
      multiSigWallet
        .connect(signers[0])
        .changeTransaction(txIndex, to, value1, data1)
    ).to.be.revertedWith("invalid tx data");
  });

  // REVOKE A CONFIRMATION
  it("Revoke a confirmation", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await multiSigWallet.connect(signers[0]).revokeConfirmation(txIndex);

    const confirmations = (await multiSigWallet.getTransaction(txIndex))
      .numConfirmations;

    expect(confirmations).to.eq(2);
  });

  it("Can't revoke a confirmation from the non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[3]).revokeConfirmation(txIndex)
    ).to.be.revertedWith("not owner");
  });

  it("Should emit RevokeConfirmation when a confirmation's been revoked", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[0]).revokeConfirmation(txIndex)
    ).to.emit(multiSigWallet, "RevokeConfirmation");
  });

  it("Can't revoke the transaction from the non-owner address", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[3]).revokeConfirmation(txIndex)
    ).to.be.revertedWith("not owner");
  });

  it("Can't revoke a transaction that doesn't exist", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[0]).revokeConfirmation(txIndex + 1)
    ).to.be.revertedWith("tx does not exist");
  });

  it("Can't revoke a transaction that has already been executed", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    await multiSigWallet.connect(signers[0]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[1]).confirmTransaction(txIndex);
    await multiSigWallet.connect(signers[2]).confirmTransaction(txIndex);

    await signers[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("2"),
    });
    await multiSigWallet.connect(signers[0]).executeTransaction(txIndex);

    await expect(
      multiSigWallet.connect(signers[0]).revokeConfirmation(txIndex)
    ).to.be.revertedWith("tx already executed");
  });

  it("Should return the number of the owners", async function () {
    const ownersNumber = owners.length;
    expect((await multiSigWallet.getOwners()).length).to.eq(ownersNumber);
  });

  it("Should return the number of transactions", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    expect(await multiSigWallet.getTransactionCount()).to.eq(1);
  });

  it("Should get a tx by its index", async function () {
    const to = testContract.address;
    const value = ethers.utils.parseEther("1");
    const data = await testContract.getData();
    const txIndex = 0;

    await multiSigWallet.connect(signers[0]).submitTransaction(to, value, data);
    const tx = await multiSigWallet.getTransaction(txIndex);
    expect(tx.to).to.eq(to);
    expect(tx.value).to.eq(value);
    expect(tx.data).to.eq(data);
  });
});
