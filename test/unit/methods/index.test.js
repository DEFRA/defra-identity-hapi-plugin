const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const td = require('testdouble')
const { URL } = require('url')
const { v4: uuid } = require('uuid')
const md5 = require('md5')

const lab = exports.lab = Lab.script()
const { describe, it, beforeEach, afterEach } = lab
const { expect } = Code

describe('Methods', () => {
  let passed
  let mock
  let outcome

  beforeEach(() => {
    passed = {
      registerDynamicsMethods: {
        options: null
      },
      cacheGet: {
        key: null,
        request: null
      },
      cacheSet: {
        key: null,
        value: null,
        ttl: null,
        request: null
      },
      cacheDrop: {
        key: null,
        request: null
      },
      readServiceEnrolment: {
        serviceId: null,
        contactId: null
      },
      getClient: {
        options: null
      },
      storeTokenSetResponse: {
        request: null,
        refreshedTokenSet: null
      },
      sanitiseTokenSet: {
        tokenSet: null
      },
      authorizationUrl: {
        options: null
      },
      methods: {},
      cookieAuthClear: {
        called: null
      },
      refreshToken: {
        refreshToken: null
      },
      retryable: {
        toExecute: null,
        callback: null
      }
    }

    const mockRetryable = (toExecute, callback) => {
      passed.retryable.toExecute = toExecute
      passed.retryable.callback = callback

      return toExecute()
    }

    mockRetryable.b2cRequestRetry = Symbol('b2cRequestRetry')

    mock = {
      server: {
        method: (name, method) => {
          passed.methods[name] = method
        },
        methods: {
          idm: {
            dynamics: {
              async readServiceEnrolment (serviceId, contactId) {
                passed.readServiceEnrolment.serviceId = serviceId
                passed.readServiceEnrolment.contactId = contactId

                return mock.serviceEnrolment
              }
            }
          }
        }
      },
      cache: {
        get: (key, request) => {
          passed.cacheGet.key = key
          passed.cacheGet.request = request

          return mock.cacheData
        },
        set: (key, value, ttl, request) => {
          passed.cacheSet.key = key
          passed.cacheSet.value = value
          passed.cacheSet.ttl = ttl
          passed.cacheSet.request = request
        },
        drop: (key, request) => {
          passed.cacheDrop.key = key
          passed.cacheDrop.request = request
        }
      },
      config: {
        cookieName: Symbol('cookie name'),
        defaultBackToPath: uuid(),
        appDomain: `https://${uuid()}.com`,
        outboundPath: uuid(),
        serviceId: Symbol('service id'),
        defaultPolicy: Symbol('default policy'),
        defaultJourney: Symbol('default journey'),
        redirectUriFqdn: Symbol('redirect uri fully qualified domain name'),
        clientId: Symbol('client id'),
        defaultScope: Symbol('default scope')
      },
      internals: {
        client: {
          getClient: (options) => {
            passed.getClient.options = options

            return {
              authorizationUrl: (options) => {
                passed.authorizationUrl.options = options

                return mock.authorizationUrl
              },
              refresh: (refreshToken) => {
                passed.refreshToken.refreshToken = refreshToken

                return mock.refreshedTokenSet
              }
            }
          }
        },
        routes: {
          storeTokenSetResponse: async (request, refreshedTokenSet) => {
            passed.storeTokenSetResponse.request = request
            passed.storeTokenSetResponse.refreshedTokenSet = refreshedTokenSet
          },
          sanitiseTokenSet: (tokenSet) => {
            passed.sanitiseTokenSet.tokenSet = tokenSet

            return tokenSet
          }
        },
        root: {
          retryable: mockRetryable
        }
      },
      request: {
        state: {},
        cookieAuth: {
          clear: () => {
            passed.cookieAuthClear.called = true
          }
        },
        query: {
          _ga: uuid()
        }
      },
      cacheData: {},
      refreshedTokenSet: { claims: {} },
      serviceEnrolment: {
        roles: Symbol('roles'),
        mappings: Symbol('mappings')
      },
      authorizationUrl: Symbol('authorization url')
    }

    mock.optionsArg = {
      server: mock.server,
      cache: mock.cache,
      config: mock.config,
      internals: mock.internals
    }

    td.replace('../../../lib/methods/dynamics', (options) => {
      passed.registerDynamicsMethods.options = options
    })

    const Methods = require('../../../lib/methods')

    Methods(mock.optionsArg)
  })

  afterEach(td.reset)

  describe('when the methods are registered', () => {
    it('should register dynamics methods', () => expect(passed.registerDynamicsMethods.options).to.equal(mock.optionsArg))
    it('should register all server methods', () => {
      const methodNames = ['idm.getCredentials',
        'idm.getClaims',
        'idm.generateAuthenticationUrl',
        'idm.logout',
        'idm.refreshToken',
        'idm.generateOutboundRedirectUrl',
        'idm.getConfig',
        'idm.getInternals',
        'idm.getCache',
        'idm.getModels']

      expect(Object.keys(passed.methods)).to.equal(methodNames)
      for (const methodName of methodNames) {
        expect(passed.methods[methodName]).to.be.a.function()
      }
    })
  })

  describe('getCredentials', () => {
    const cacheKey = Symbol('cacheKey')
    beforeEach(async () => {
      mock.request.state[mock.config.cookieName] = { cacheKey }

      outcome = await passed.methods['idm.getCredentials'](mock.request)
    })

    it('should get the cache record', () => expect(passed.cacheGet).to.equal({
      key: cacheKey,
      request: mock.request
    }))
    it('should return an object', () => expect(outcome).to.be.an.object())
    it('should furnish the response with an isExpired method', () => expect(outcome.isExpired).to.be.a.function())
  })

  describe('getClaims', () => {
    const cacheKey = Symbol('cacheKey')
    beforeEach(async () => {
      mock.request.state[mock.config.cookieName] = { cacheKey }
      mock.cacheData.claims = Symbol('claims')

      outcome = await passed.methods['idm.getClaims'](mock.request)
    })

    it('should return the user\'s claims', () => expect(outcome).to.equal(mock.cacheData.claims))
  })

  describe('generateAuthenticationUrl', () => {
    beforeEach(() => {
      outcome = passed.methods['idm.generateAuthenticationUrl'](null, {
        returnUrlObject: true,
        _ga: mock.request.query._ga
      })

      it('should return a url object', () => expect(outcome).to.be.an.instanceOf(URL))
      it('should include the _ga parameter', () => expect(outcome.searchParams._ga).to.equal(mock.request.query._ga))
    })
  })

  describe('logout', () => {
    const cacheKey = Symbol('cacheKey')
    beforeEach(async () => {
      mock.request.state[mock.config.cookieName] = { cacheKey }

      outcome = passed.methods['idm.logout'](mock.request)
    })

    it('should drop the cache record', () => expect(passed.cacheDrop).to.equal({
      key: cacheKey,
      request: mock.request
    }))
    it('should clear the cookieAuth', () => expect(passed.cookieAuthClear.called).to.equal(true))
  })

  describe('refreshToken', () => {
    let contactId
    let existingCredentials

    beforeEach(async () => {
      contactId = Symbol('contact id')

      existingCredentials = {
        tokenSet: {
          refresh_token: Symbol('refresh token')
        },
        claims: {
          tfp: Symbol('trust framework policy')
        }
      }

      const getCredentials = async () => existingCredentials

      outcome = await passed.methods['idm.refreshToken'](mock.request, contactId, { getCredentials })
    })

    it('should get the oidc client object', () => expect(passed.getClient.options).to.equal({
      policyName: existingCredentials.claims.tfp
    }))
    it('should use retryable to execute the refresh', () => {
      expect(passed.retryable.toExecute).to.be.a.function()
      expect(passed.retryable.callback).to.equal(mock.internals.root.retryable.b2cRequestRetry)
    })
    it('should refresh the token', () => expect(passed.refreshToken.refreshToken).to.equal(existingCredentials.tokenSet.refresh_token))
    it('should fetch the user\'s roles', () => expect(passed.readServiceEnrolment).to.equal({
      serviceId: mock.config.serviceId,
      contactId
    }))
    it('should furnish the refreshed token with roles, mappings and contact id', () => expect(mock.refreshedTokenSet).to.equal({
      claims: {
        roles: mock.serviceEnrolment.roles,
        roleMappings: mock.serviceEnrolment.mappings,
        contactId
      }
    }))
    it('should store the token set response', () => expect(passed.storeTokenSetResponse).to.equal({
      request: mock.request,
      refreshedTokenSet: mock.refreshedTokenSet
    }))
  })

  describe('generateOutboundRedirectUrl', () => {
    let state
    beforeEach(async () => {
      state = uuid()

      outcome = await passed.methods['idm.generateOutboundRedirectUrl'](mock.request, { _ga: mock.request.query._ga }, { state })
    })

    it('should set the state in cache', () => expect(passed.cacheSet).to.equal({
      key: md5(state),
      value: {
        policyName: mock.config.defaultPolicy,
        forceLogin: false,
        backToPath: '',
        journey: mock.config.defaultJourney,
        nonce: undefined
      },
      ttl: undefined,
      request: mock.request
    }))
    it('should fetch the client oidc object', () => expect(passed.getClient.options).to.equal({
      policyName: mock.config.defaultPolicy
    }))
    it('should create an authorization url', () => expect(passed.authorizationUrl.options).to.equal({
      redirect_uri: mock.config.redirectUriFqdn,
      scope: mock.config.defaultScope,
      state,
      prompt: undefined,
      response_type: 'code',
      response_mode: 'form_post',
      client_id: mock.config.clientId,
      policyName: mock.config.defaultPolicy,
      journey: mock.config.defaultJourney,
      serviceId: mock.config.serviceId,
      nonce: undefined,
      _ga: mock.request.query._ga
    }))
  })
})
