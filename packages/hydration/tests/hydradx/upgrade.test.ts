import * as fs from 'fs'
import { assert, describe, it } from 'vitest'
import { blake2AsHex } from '@polkadot/util-crypto'
import { checkEvents } from '../../support/helpers'
import { defaultAccounts } from '@e2e-test/networks'
import { hydraDX, moonbeam, polkadot } from '@e2e-test/networks/chains'
import { query, tx } from '@e2e-test/shared/api'
import { sendTransaction, testingPairs } from '@acala-network/chopsticks-testing'
import { setupNetworks } from '@e2e-test/shared'

describe('hydraDX upgrade', async () => {
  const hydraDXDot = hydraDX.custom.relayToken
  const moonbeamDot = moonbeam.custom.dot

  it('Transfer DOT to moonbeam', async () => {
    const [hydraDXClient, moonbeamClient, polkadotClient] = await setupNetworks(hydraDX, moonbeam, polkadot)

    //Perform runtime version upgrade
    const cwd = process.cwd()
    console.log(`Current directory: ${cwd}`)
    const upgradePath = process.env.HYDRADX_RUNTIME_WASM_PATH || `${cwd}/packages/hydration/tests/hydradx/256.wasm`

    console.log('Upgrade path: ' + upgradePath)
    await performUpgrade(hydraDXClient, upgradePath)

    //Do XCM transfer
    const xtransfer = tx.xtokens.transfer(hydraDXDot, 2e10, tx.xtokens.parachainAccountId20V3(moonbeam.paraId!))
    const txx = xtransfer(hydraDXClient, defaultAccounts.alith.addressRaw)
    const tx0 = await sendTransaction(txx.signAsync(defaultAccounts.alice))

    const alithOldBalance = await moonbeamClient.api.query.assets.account(moonbeamDot, defaultAccounts.alith.address)
    assert(alithOldBalance.isNone)

    //To have the xcm message sent from hydraDX, and processed on moonbeam, the blocks need to be produced in this order
    await hydraDXClient.chain.newBlock()
    await polkadotClient.chain.newBlock()
    await moonbeamClient.chain.newBlock()

    //Check if the transfer was successful
    const alithNewBalance = (await moonbeamClient.api.query.assets.account(moonbeamDot, defaultAccounts.alith.address))
      .unwrap()
      .balance.toNumber()

    assert(alithNewBalance > 0, 'Alice did not receive any token')
  })
})

async function performUpgrade(hydraDXClient, upgradePath) {
  const code = fs.readFileSync(upgradePath).toString('hex')
  const alice = defaultAccounts.alice

  const currentSpecVersion = hydraDXClient.api.runtimeVersion.specVersion.toNumber()
  console.log(`Spec version before upgrade: ${currentSpecVersion}`)
  const proposal = hydraDXClient.api.tx.parachainSystem.authorizeUpgrade(blake2AsHex(`0x${code}`), false)
  const encodedProposal = proposal.method.toHex()
  console.log('Encoded proposal: ' + encodedProposal)
  const encodedHash = blake2AsHex(encodedProposal)

  const tx11 = hydraDXClient.api.tx.preimage.notePreimage(encodedProposal)
  const tx0 = await sendTransaction(tx11.signAsync(alice))
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
  const c1tx = await sendTransaction(c1.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  console.log('Propose fast track by Technical Committee')
  const tc = hydraDXClient.api.tx.technicalCommittee.propose(1, fastTrack, fastTrack.length)
  const tctx = await sendTransaction(tc.signAsync(alice))
  await hydraDXClient.chain.newBlock()

  let referendumNextIndex = (await hydraDXClient.api.query.democracy.referendumCount()).toNumber()
  referendumNextIndex = referendumNextIndex - 1
  console.log('Referendum index: ' + referendumNextIndex)
  const referendumInfo = await hydraDXClient.api.query.democracy.referendumInfoOf(referendumNextIndex)
  //console.log("Referendum info:", referendumInfo.toHuman());

  console.log('Voting on referendum')
  const voteTx = hydraDXClient.api.tx.democracy.vote(referendumNextIndex, {
    Standard: {
      balance: voteAmount,
      vote: { aye: true, conviction: 1 },
    },
  })

  const voteTx2 = await sendTransaction(voteTx.signAsync(alice))
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  const entries = await hydraDXClient.api.query.democracy.referendumInfoOf.entries()

  for (const entry of entries) {
    const idx = hydraDXClient.api.registry.createType('u32', entry[0].toU8a().slice(-4)).toNumber()
    if (idx == referendumNextIndex) {
      const f = entry[1].unwrap().isFinished
      console.log('Has Refeferendum finished: ' + f)
    }
  }

  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  console.log('Enacting auhtorized upgrade')
  const enact = hydraDXClient.api.tx.parachainSystem.enactAuthorizedUpgrade(`0x${code}`)
  const enactTx = await sendTransaction(enact.signAsync(alice))
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()
  await hydraDXClient.chain.newBlock()

  const newSpecVersion = hydraDXClient.api.runtimeVersion.specVersion.toNumber()

  console.log('Spec version after upgrade: ', hydraDXClient.api.runtimeVersion.specVersion.toNumber())
  assert(newSpecVersion > currentSpecVersion, 'The spec version has not been increased')
}

/*
console.log("CREATING DCA:");
const nonce = await hydraApi.rpc.system.accountNextIndex(defaultAccounts.alice.publicKey);
await createDca(hydraApi, defaultAccounts.alice, defaultAccounts.alice.publicKey, nonce, 0)*/
async function createDca(api, user, user_pub_key, nonce, tip) {
  try {
    await api.tx.dca
      .schedule(
        {
          owner: user_pub_key,
          period: 1,
          totalAmount: 1000000000000000,
          maxRetries: null,
          stabilityThreshold: null,
          slippage: null,
          order: {
            Sell: {
              assetIn: 5,
              assetOut: 2,
              amountIn: 100000000000000,
              minAmountOut: 0,
              route: null,
            },
          },
        },
        null,
      )
      .signAndSend(user, { nonce, tip })
  } catch (error) {
    console.log('Error while sending DCA - Sent transaction counter when signing fails: ' + error)
  }
}
