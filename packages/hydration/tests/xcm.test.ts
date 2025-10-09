import { sendTransaction } from '@acala-network/chopsticks-testing'

import { defaultAccounts } from '@e2e-test/networks'
import { acala, hydration, moonbeam, polkadot } from '@e2e-test/networks/chains'
import { setupNetworks } from '@e2e-test/shared'
import { query, tx } from '@e2e-test/shared/api'

import { assert, describe, it } from 'vitest'

import { performRuntimeUpgradeOnHydraWasmViaReferenda } from './utils.js'

describe('XCM transfers', async () => {
  const hydraDXDot = hydration.custom.relayToken
  const moonbeamDot = moonbeam.custom.dot
  const acalaDot = acala.custom.dot

  it.skip('Transfer DOT to Moonbeam', async () => {
    const [hydraDXClient, moonbeamClient, polkadotClient] = await setupNetworks(hydration, moonbeam, polkadot)

    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)

    //Do XCM transfer
    const xtransfer = tx.xtokens.transfer(hydraDXDot, 2e10, tx.xtokens.parachainAccountId20V3(moonbeam.paraId!))
    const txx = xtransfer(hydraDXClient, defaultAccounts.alith.addressRaw)
    const _tx0 = await sendTransaction(txx.signAsync(defaultAccounts.alice))

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

    const _newSpecVersion = await hydraDXClient.api.runtimeVersion.specVersion.toNumber()
    //assert(newSpecVersion == 349, 'The spec version is not as expected')

    assert(alithNewBalance > 0, 'Alice did not receive any token')
  })

  it('Transfer DOT to Acala', async () => {
    const [hydraDXClient, acalaClient, polkadotClient] = await setupNetworks(hydration, acala, polkadot)

    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)

    const getAcalaDotBalance = query.tokens(acalaDot)
    const aliceOldBalance = await getAcalaDotBalance(acalaClient, defaultAccounts.alice.address)

    //Do XCM transfer
    const xtransfer = tx.xtokens.transfer(hydraDXDot, 2e10, tx.xtokens.parachainV3(acala.paraId!))
    const txx = xtransfer(hydraDXClient, defaultAccounts.alice.addressRaw)
    const _tx0 = await sendTransaction(txx.signAsync(defaultAccounts.alice))

    //To have the xcm message sent from hydraDX, and processed on acala, the blocks need to be produced in this order
    await hydraDXClient.chain.newBlock()
    await polkadotClient.chain.newBlock()
    await acalaClient.chain.newBlock()

    //Check if the transfer was successful
    const aliceNewBalance = await getAcalaDotBalance(acalaClient, defaultAccounts.alice.address)
    assert(aliceNewBalance > aliceOldBalance, 'Alice did not receive any token from xcm transfer')
  })
})
