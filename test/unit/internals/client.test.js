const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const { v4: uuid } = require('uuid')
const td = require('testdouble')
const lab = exports.lab = Lab.script()

const { describe, it, beforeEach, afterEach } = lab
const { expect } = Code

describe('Internals - client', () => {
  let mock
  let passed
  let outcome
  let clientMethods

  beforeEach(() => {
    passed = {
      issuerDiscover: {
        url: null
      },
      issuerClient: {
        options: null
      },
      client: {
        clockTolerance: null
      }
    }

    mock = {
      args: {
        config: {
          clientId: uuid(),
          clientSecret: uuid(),
          defaultPolicy: uuid(),
          identityAppUrl: uuid()
        },
        policyName: uuid()
      },
      data: {
        issuer: {
          Client: class {
            constructor (options) {
              passed.issuerClient.options = options
            }

            get CLOCK_TOLERANCE () {
              return passed.client.clockTolerance
            }

            set CLOCK_TOLERANCE (clockTolerance) {
              passed.client.clockTolerance = clockTolerance
            }
          }
        }
      },
      modules: {
        openidClient: {
          Issuer: {
            defaultHttpOptions: {
              timeout: null,
              retries: null
            },
            discover: (url) => {
              passed.issuerDiscover.url = url

              return mock.data.issuer
            }
          },
          custom: {
            clock_tolerance: Symbol('clock tolerance')
          }
        }
      }
    }

    td.replace('openid-client', mock.modules.openidClient)

    clientMethods = require('../../../lib/internals/client')
  })

  afterEach(td.reset)

  describe('When the file is required', () => {
    it('should set the issuer default http options', () => expect(mock.modules.openidClient.Issuer.defaultHttpOptions).to.equal({
      timeout: 5000,
      retries: 2
    }))

    describe('and the exported function is executed', () => {
      beforeEach(() => {
        outcome = clientMethods({})
      })

      it('should export an object of functions', () => {
        expect(Object.keys(outcome)).to.equal(['getClient'])
      })
    })
  })

  describe('getClient', () => {
    describe('When not passed a policyName', () => {
      beforeEach(async () => {
        const methods = outcome = clientMethods({ config: mock.args.config })

        outcome = await methods.getClient()
      })

      it('should perform discovery on the identity app url set in config including the default policy name', () => expect(passed.issuerDiscover.url).to.equal(`${mock.args.config.identityAppUrl}/.well-known/openid-configuration?p=${mock.args.config.defaultPolicy}`))
    })

    describe('When passed a policyName', () => {
      beforeEach(async () => {
        const methods = outcome = clientMethods({ config: mock.args.config })

        outcome = await methods.getClient({ policyName: mock.args.policyName })
      })

      it('should perform discovery on the identity app url set in config including the passed policy name', () => expect(passed.issuerDiscover.url).to.equal(`${mock.args.config.identityAppUrl}/.well-known/openid-configuration?p=${mock.args.policyName}`))
      it('should create a new client instance', () => expect(passed.issuerClient.options).to.equal({
        client_id: mock.args.config.clientId,
        client_secret: mock.args.config.clientSecret
      }))
      it('should set the clock tolerance', () => expect(outcome[mock.modules.openidClient.custom.clock_tolerance]).to.equal(300))
      it('should return the client', () => expect(outcome).to.be.an.instanceof(mock.data.issuer.Client))
    })
  })
})
