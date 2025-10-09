import { sendTransaction } from '@acala-network/chopsticks-testing'

import { defaultAccounts } from '@e2e-test/networks'

import { blake2AsHex } from '@polkadot/util-crypto'

import * as fs from 'node:fs'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient) {
  const cwd = process.cwd()
  console.log(`Current directory: ${cwd}`)
  const upgradePath = process.env.HYDRADX_RUNTIME_WASM_PATH || `${cwd}/packages/hydration/tests/348.wasm`

  console.log(`Upgrade path: ${upgradePath}`)
  await performUpgradeViaReferenda(hydraDXClient, upgradePath)
}

// DEPRECATED: Old way of performing upgrades via external proposal
export async function performRuntimeUpgradeOnHydraWasm(hydraDXClient) {
  const cwd = process.cwd()
  console.log(`Current directory: ${cwd}`)
  const upgradePath = process.env.HYDRADX_RUNTIME_WASM_PATH || `${cwd}/packages/hydration/tests/hydradx/348.wasm`

  console.log(`Upgrade path: ${upgradePath}`)
  await performUpgrade(hydraDXClient, upgradePath)
}

async function performUpgradeViaReferenda(hydraDXClient, upgradePath) {
  const code = fs.readFileSync(upgradePath).toString('hex')
  const alice = defaultAccounts.alice

  const currentSpecVersion = hydraDXClient.api.runtimeVersion.specVersion.toNumber()
  console.log(`Spec version before upgrade: ${currentSpecVersion}`)

  // Create the authorize upgrade proposal
  const proposal = hydraDXClient.api.tx.system.authorizeUpgrade(blake2AsHex(`0x${code}`))
  const encodedProposal = proposal.method.toHex()
  console.log(`Encoded proposal: ${encodedProposal}`)
  const encodedHash = blake2AsHex(encodedProposal)

  // Step 1: Note preimage
  console.log('Noting preimage...')
  const tx11 = hydraDXClient.api.tx.preimage.notePreimage(encodedProposal)
  await sendTransaction(tx11.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  // Step 2: Submit proposal via referenda
  console.log('Submitting proposal via referenda...')
  const proposalOrigin = {
    system: 'Root',
  }
  const proposal_call = {
    Lookup: {
      hash: encodedHash,
      len: encodedProposal.length / 2 - 1,
    },
  }
  const enactmentMoment = { After: 1 }

  const submitTx = hydraDXClient.api.tx.referenda.submit(proposalOrigin, proposal_call, enactmentMoment)
  await sendTransaction(submitTx.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  // Get the referendum index (latest referendum)
  const referendumIndex = (await hydraDXClient.api.query.referenda.referendumCount()).toNumber() - 1
  console.log(`Referendum index: ${referendumIndex}`)

  // Step 3: Place decision deposit
  console.log('Placing decision deposit...')

  // First check the referendum status before placing deposit
  const refInfoBeforeDeposit = await hydraDXClient.api.query.referenda.referendumInfoFor(referendumIndex)
  console.log('Referendum info BEFORE decision deposit:', refInfoBeforeDeposit.toHuman())

  const decisionDepositTx = hydraDXClient.api.tx.referenda.placeDecisionDeposit(referendumIndex)
  const decisionDepositResult = await sendTransaction(decisionDepositTx.signAsync(alice))
  console.log('Decision deposit tx result:', decisionDepositResult)

  console.log('Decision deposit placed, check blocks after')
  sleep(6000)
  // Produce multiple blocks to ensure deposit is processed
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()
  console.log('Decision deposit placed, check blocks after')
  sleep(6000)

  // Check referendum status after decision deposit
  const refInfoAfterDeposit = await hydraDXClient.api.query.referenda.referendumInfoFor(referendumIndex)
  console.log('Referendum info AFTER decision deposit:', refInfoAfterDeposit.toHuman())

  // Step 4: Vote with 4 billion HDX to pass it quickly
  console.log('Voting on referendum with 4 billion HDX...')
  await sleep(6000)

  const voteAmount = 4_000_000_000_000_000n * 10n ** BigInt(hydraDXClient.api.registry.chainDecimals[0])
  const voteTx = hydraDXClient.api.tx.convictionVoting.vote(referendumIndex, {
    Standard: {
      balance: voteAmount,
      vote: { aye: true, conviction: 'Locked1x' },
    },
  })
  await sendTransaction(voteTx.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  sleep(6000)
  // Wait for referendum to pass
  console.log('Waiting for referendum to pass...')
  for (let i = 0; i < 10; i++) {
    sleep(5000)

    await hydraDXClient.chain.newBlock()
  }

  // Check referendum status
  const referendumInfo = await hydraDXClient.api.query.referenda.referendumInfoFor(referendumIndex)
  console.log('Referendum info:', referendumInfo.toHuman())

  // Step 5: Enact the authorized upgrade
  console.log('Enacting authorized upgrade...')
  const enact = hydraDXClient.api.tx.system.applyAuthorizedUpgrade(`0x${code}`)
  await sendTransaction(enact.signAsync(alice))
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  const newSpecVersion = hydraDXClient.api.runtimeVersion.specVersion.toNumber()
  console.log('Spec version after upgrade: ', newSpecVersion)
}

// DEPRECATED: Old way of performing upgrades via external proposal and democracy
async function performUpgrade(hydraDXClient, upgradePath) {
  const code = fs.readFileSync(upgradePath).toString('hex')
  const alice = defaultAccounts.alice

  const currentSpecVersion = hydraDXClient.api.runtimeVersion.specVersion.toNumber()
  console.log(`Spec version before upgrade: ${currentSpecVersion}`)
  const proposal = hydraDXClient.api.tx.system.authorizeUpgrade(blake2AsHex(`0x${code}`))
  const encodedProposal = proposal.method.toHex()
  console.log(`Encoded proposal: ${encodedProposal}`)
  const encodedHash = blake2AsHex(encodedProposal)

  const tx11 = hydraDXClient.api.tx.preimage.notePreimage(encodedProposal)
  const _tx0 = await sendTransaction(tx11.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  const proposalCall = hydraDXClient.api.registry.createType('Call', {
    callIndex: proposal.method.callIndex,
    args: proposal.method.args,
  })

  const external = hydraDXClient.api.tx.democracy.externalProposeMajority({
    Inline: proposalCall.toHex(),
  })

  const fastTrack = hydraDXClient.api.tx.democracy.fastTrack(encodedHash, 2, 1)

  const voteAmount = 1n * 10n ** BigInt(hydraDXClient.api.registry.chainDecimals[0])

  const c1 = hydraDXClient.api.tx.council.propose(1, external, external.length)
  const _c1tx = await sendTransaction(c1.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  console.log('Propose fast track by Technical Committee')
  const tc = hydraDXClient.api.tx.technicalCommittee.propose(1, fastTrack, fastTrack.length)
  const _tctx = await sendTransaction(tc.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  let referendumNextIndex = (await hydraDXClient.api.query.democracy.referendumCount()).toNumber()
  referendumNextIndex = referendumNextIndex - 1
  console.log(`Referendum index: ${referendumNextIndex}`)
  const _referendumInfo = await hydraDXClient.api.query.democracy.referendumInfoOf(referendumNextIndex)
  //console.log("Referendum info:", referendumInfo.toHuman());

  console.log('Voting on referendum')
  const voteTx = hydraDXClient.api.tx.democracy.vote(referendumNextIndex, {
    Standard: {
      balance: voteAmount,
      vote: { aye: true, conviction: 1 },
    },
  })

  const _voteTx2 = await sendTransaction(voteTx.signAsync(alice))
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  const entries = await hydraDXClient.api.query.democracy.referendumInfoOf.entries()

  for (const entry of entries) {
    const idx = hydraDXClient.api.registry.createType('u32', entry[0].toU8a().slice(-4)).toNumber()
    if (idx === referendumNextIndex) {
      const f = entry[1].unwrap().isFinished
      console.log(`Has Refeferendum finished: ${f}`)
    }
  }

  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  console.log('Enacting auhtorized upgrade')
  const enact = hydraDXClient.api.tx.system.applyAuthorizedUpgrade(`0x${code}`)
  const _enactTx = await sendTransaction(enact.signAsync(alice))
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  const _newSpecVersion = await hydraDXClient.api.runtimeVersion.specVersion.toNumber()

  console.log('Spec version after upgrade: ', hydraDXClient.api.runtimeVersion.specVersion.toNumber())
  //assert(newSpecVersion > currentSpecVersion, 'The spec version has not been increased')
}
