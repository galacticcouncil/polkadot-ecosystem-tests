import { hydrationWithBlockNumber, moonbeam, polkadot } from '@e2e-test/networks/chains'
import { setupNetworks } from '@e2e-test/shared'

import { assert, describe, it } from 'vitest'

import { performRuntimeUpgradeOnHydraWasmViaReferenda } from './utils.js'

const USED_BLOCKS_FOR_UPGRADE = 20

describe('Check important DCA schedule executions', async () => {
  it('Polkadot Treasury DCA 15444', async () => {
    // Arrange

    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(9479421 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)
    console.log('Upgrade completed')
    console.log('Adding new block to trigger DCA execution...')
    await hydraDXClient.chain.newBlock()
    console.log('New block added')

    // Assert
    console.log('Checking for TradeExecuted event for DCA schedule 15444...')
    const expectedScheduleId = 15444
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15445', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(9478848 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15445
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15446', async () => {
    // Arrange
    const [hydraDXClient, _polkadotClient] = await setupNetworks(
      hydrationWithBlockNumber(9478824 - USED_BLOCKS_FOR_UPGRADE),
      polkadot,
    )

    // Act
    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15446
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })

  it('Polkadot Treasury DCA 15447', async () => {
    // Arrange
    const [hydraDXClient] = await setupNetworks(hydrationWithBlockNumber(9478855 - USED_BLOCKS_FOR_UPGRADE))

    // Act
    await performRuntimeUpgradeOnHydraWasmViaReferenda(hydraDXClient)
    await hydraDXClient.chain.newBlock()

    // Assert
    const expectedScheduleId = 15447
    const event = await checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId)
    assert(event, `DCA schedule ${expectedScheduleId} trade was not successfully executed`)
  })
})

async function checkForTradeExecutedEvent(hydraDXClient, expectedScheduleId) {
  try {
    // Get current block number
    const header = await hydraDXClient.api.rpc.chain.getHeader()
    const blockNumber = header.number.toNumber()
    console.log(`Checking block number: ${blockNumber}`)

    const events = await hydraDXClient.api.query.system.events()
    const tradeExecutedEvents = []
    let expectedScheduleEvent = null

    for (const record of events) {
      const { event } = record
      if (event.section === 'dca' && event.method === 'TradeExecuted') {
        const [id, who, amountIn, amountOut] = event.data
        tradeExecutedEvents.push({ id, who, amountIn, amountOut })

        if (id.toString() === expectedScheduleId.toString()) {
          expectedScheduleEvent = { id, who, amountIn, amountOut }
        }
      }
    }

    // Print all DCA IDs with TradeExecuted events
    if (tradeExecutedEvents.length > 0) {
      console.log(`Found ${tradeExecutedEvents.length} TradeExecuted event(s) in block ${blockNumber}:`)
      for (const event of tradeExecutedEvents) {
        console.log(`  - ScheduleId: ${event.id.toString()}`)
      }
    } else {
      console.log(`No TradeExecuted events found in block ${blockNumber}`)
    }

    if (expectedScheduleEvent) {
      console.log(`✓ Expected ScheduleId ${expectedScheduleId} found!`)
      return expectedScheduleEvent
    }
    console.log(`✗ Expected ScheduleId ${expectedScheduleId} NOT found`)
    return null
  } catch (error) {
    console.error('Failed to fetch events:', error)
    throw error
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
