import * as fs from 'fs'
import { assert, describe, it } from 'vitest'
import { blake2AsHex } from '@polkadot/util-crypto'
import { defaultAccounts } from '@e2e-test/networks'
import { hydration, hydrationWithBlockNumber } from '@e2e-test/networks/chains'
import { performRuntimeUpgradeOnHydraWasm } from './xcm.test.js'
import { query } from '@e2e-test/shared/api'
import { sendTransaction } from '@acala-network/chopsticks-testing'
import { setupNetworks } from '@e2e-test/shared'

const USED_BLOCKS_FOR_UPGRADE = 10

describe('Check important DCA schedule executions', async () => {
  it('Polkadot Treasury DCA 15444', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(7434843 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasm(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15444
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15445', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(7434854 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasm(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15445
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15446', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(7434934 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasm(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15446
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15447', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(7434933 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasm(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15447
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Use DCA schedule 15402 that should not fail when rounding happens in AAVE contract', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(7396903 - USED_BLOCKS_FOR_UPGRADE))
    /*const schedule = await hydraDXClient.api.query.dca.schedules(15402);
    console.log('Schedule:', schedule.toPrimitive());*/

    // Act
    await performRuntimeUpgradeOnHydraWasm(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15402
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })
})

async function logCurrentBlockNumber(hydraDXClient) {
  try {
    const header = await hydraDXClient.api.rpc.chain.getHeader()
    const blockNumber = header.number.toNumber()
    console.log('Block number:', blockNumber)
  } catch (error) {
    console.error('Failed to fetch block number:', error)
  }
}

async function checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId) {
  try {
    const events = await hydraDXClient.api.query.system.events()
    for (const record of events) {
      const { event } = record
      if (event.section === 'dca' && event.method === 'TradeExecuted') {
        const [id, who, amountIn, amountOut] = event.data
        if (id.toString() === expectedScheduleId.toString()) {
          console.log(`TradeExecuted event found for ScheduleId ${id}`)
          return { id, who, amountIn, amountOut }
        }
      }
    }
    console.log('TradeExecuted event not found for the specified ScheduleId')
    return null
  } catch (error) {
    console.error('Failed to fetch events:', error)
    throw error
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
