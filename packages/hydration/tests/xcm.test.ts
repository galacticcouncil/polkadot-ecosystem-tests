import { sendTransaction } from '@acala-network/chopsticks-testing'

import { defaultAccounts } from '@e2e-test/networks'
import { acala, assetHubPolkadot, hydration, moonbeam, polkadot } from '@e2e-test/networks/chains'
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

    const xtransfer = tx.xtokens.transfer(hydraDXDot, 2e10, tx.xtokens.parachainAccountId20V3(moonbeam.paraId!))
    const txx = xtransfer(hydraDXClient, defaultAccounts.alith.addressRaw)
    await sendTransaction(txx.signAsync(defaultAccounts.alice))

    const alithOldBalance = await moonbeamClient.api.query.assets.account(moonbeamDot, defaultAccounts.alith.address)
    assert(alithOldBalance.isNone)

    await hydraDXClient.chain.newBlock()
    await polkadotClient.chain.newBlock()
    await moonbeamClient.chain.newBlock()

    const alithNewBalance = (await moonbeamClient.api.query.assets.account(moonbeamDot, defaultAccounts.alith.address))
      .unwrap()
      .balance.toNumber()

    assert(alithNewBalance > 0, 'Alice did not receive any token')
  })

  it('Transfer DOT to Acala', async () => {
    // Post-AHM, DOT must be reserve-transferred via Asset Hub.
    // xtokens UMP-via-relay is rejected by Acala's barrier; we use polkadotXcm
    // with RemoteReserve(AssetHub) so the message goes hydration → AssetHub → Acala over HRMP.
    const [hydraDXClient, acalaClient, assetHubPolkadotClient] = await setupNetworks(hydration, acala, assetHubPolkadot)

    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)

    const getAcalaDotBalance = query.tokens(acalaDot)
    const aliceOldBalance = await getAcalaDotBalance(acalaClient, defaultAccounts.alice.address)

    const remoteReserve = {
      RemoteReserve: { V4: { parents: 1, interior: { X1: [{ Parachain: assetHubPolkadot.paraId }] } } },
    } as any
    const transfer = tx.xcmPallet.transferAssetsUsingType(
      tx.xcmPallet.parachainV4(1, acala.paraId!),
      [{ id: { parents: 1, interior: 'Here' }, fun: { Fungible: 2e10 } }],
      remoteReserve,
      { parents: 1, interior: 'Here' },
      remoteReserve,
    )
    const txx = transfer(hydraDXClient, defaultAccounts.alice.addressRaw)
    await sendTransaction(txx.signAsync(defaultAccounts.alice))

    await hydraDXClient.chain.newBlock()
    await assetHubPolkadotClient.chain.newBlock()
    await acalaClient.chain.newBlock()

    const aliceNewBalance = await getAcalaDotBalance(acalaClient, defaultAccounts.alice.address)
    assert(aliceNewBalance > aliceOldBalance, 'Alice did not receive any token from xcm transfer')
  })
})
