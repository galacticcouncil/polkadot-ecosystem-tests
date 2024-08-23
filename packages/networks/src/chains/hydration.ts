import { defaultAccounts } from '../defaultAccounts.js'
import { defineChain } from '../defineChain.js'

const custom = {
  hydration: {
    dai: 2,
    relayToken: 5,
    glmr: 16,
  },
  basilisk: {
    bsx: 0,
    dai: 13,
    relayToken: 1,
  },
}

const getInitStorages = (config: typeof custom.hydration | typeof custom.basilisk) => ({
  System: {
    Account: [[[defaultAccounts.alice.address], { providers: 1, data: { free: 10n ** 18n } }]],
  },
  Tokens: {
    Accounts: [
      [[defaultAccounts.alice.address, config.relayToken], { free: 1000 * 1e12 }],
      [[defaultAccounts.alice.address, config.dai], { free: 100n * 10n ** 18n }],
    ],
  },

  Council: {
    members: [defaultAccounts.alice.address],
  },
  TechnicalCommittee: {
    members: [defaultAccounts.alice.address],
  },
})

export const hydration = defineChain({
  name: 'hydration',
  paraId: 2034,
  endpoint: 'wss://rpc.hydradx.cloud',
  custom: custom.hydration,
  initStorages: getInitStorages(custom.hydration),
})

export const basilisk = defineChain({
  name: 'basilisk',
  paraId: 2090,
  endpoint: 'wss://basilisk-rpc.dwellir.com',
  custom: custom.basilisk,
  initStorages: getInitStorages(custom.basilisk),
})
