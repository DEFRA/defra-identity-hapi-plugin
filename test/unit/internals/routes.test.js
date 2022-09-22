const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const md5 = require('md5')
const { URLSearchParams } = require('url')
const lab = exports.lab = Lab.script()

const { describe, it } = lab
const { expect } = Code

const RouteMethods = require('../../../lib/internals/routes')

describe('Internals - routes', () => {
  describe('sanitiseTokenSet', () => {
    describe('When a claims function is passed', () => {
      it('should set the claims function response as the claims value', () => {
        const claims = {
          abc: 321
        }
        const tokenSet = {
          claims: () => claims
        }

        const routeMethods = RouteMethods({
          cache: {},
          config: {}
        })

        const output = routeMethods.sanitiseTokenSet(tokenSet)

        expect(output).to.equal({
          claims
        })
      })
    })
  })
  describe('storeTokenSetResponse', () => {
    it('should store tokenSet in cache and in cookieAuth', async () => {
      const passed = {
        cache: {
          key: null,
          value: null,
          ttl: null,
          request: null
        },
        cookieAuth: {
          value: null
        }
      }

      const mock = {
        request: {
          cookieAuth: {
            set: (value) => {
              passed.cookieAuth.value = value
            }
          }
        },
        claims: {
          sub: Symbol('sub')
        },
        tokenSet: {
          claims: () => mock.claims
        },
        cache: {
          set: (key, value, ttl, request) => {
            passed.cache.key = key
            passed.cache.value = value
            passed.cache.ttl = ttl
            passed.cache.request = request
          }
        }
      }

      const routeMethods = RouteMethods({
        cache: mock.cache,
        config: {}
      })

      const output = await routeMethods.storeTokenSetResponse(mock.request, mock.tokenSet)

      expect(output).to.be.undefined()
      expect(passed.cache.key).to.be.a.string()
      expect(passed.cache.value).to.equal({
        tokenSet: mock.tokenSet,
        claims: mock.claims
      })
      expect(passed.cache.ttl).to.be.undefined()
      expect(passed.cache.request).to.equal(mock.request)

      expect(passed.cookieAuth.value).to.equal({
        cacheKey: passed.cache.key
      })
    })

    it('should use the request object\'s cacheKey to set the token', async () => {
      let spyCacheSet, spyRequestSet
      const routeMethods = RouteMethods({
        cache: { set: (w, x, y, z) => { spyCacheSet = [w, x, y, z] } },
        config: { cookieName: 'testCookieAuth' }
      })
      const mockRequest = {
        cookieAuth: { set: x => { spyRequestSet = x } },
        state: { testCookieAuth: { cacheKey: 'cache-key-cache-key' } }
      }
      const stubClaims = 'claims-claims-claims'

      const stubTokenSet = { claims: () => stubClaims }
      await routeMethods.storeTokenSetResponse(mockRequest, stubTokenSet)

      expect(spyCacheSet).to.equal([
        'cache-key-cache-key',
        {
          claims: stubClaims,
          tokenSet: stubTokenSet
        },
        undefined,
        mockRequest
      ])

      expect(spyRequestSet.cacheKey).to.equal('cache-key-cache-key')
    })
  })

  describe('handleAuthorisationError', () => {
    it('should redirect to full qualified error redirect url with error details in the url', async () => {
      const mock = {
        request: Symbol('request'),
        h: {
          redirect: (path) => path
        },
        savedState: {},
        authorisationErr: {
          message: 'error message',
          error_description: 'error description',
          state: JSON.stringify('{ state: testState }')
        },
        config: {
          appDomain: 'https://app.domain',
          disallowedRedirectPath: '/disallowed-redirect-path'
        }
      }

      const routeMethods = RouteMethods({
        config: mock.config
      })

      const output = await routeMethods.handleAuthorisationError(mock.request, mock.h, mock.savedState, mock.authorisationErr)

      const querystring = (new URLSearchParams({
        errorMessage: mock.authorisationErr.message,
        errorDescription: mock.authorisationErr.error_description,
        state: mock.authorisationErr.state
      })).toString()

      expect(output).to.equal(`${mock.config.appDomain}${mock.config.disallowedRedirectPath}?${querystring}`)
    })

    it('should redirect to full qualified error redirect url with a key for "state" in the query but no value for it', async () => {
      const mock = {
        request: Symbol('request'),
        h: {
          redirect: (path) => path
        },
        savedState: {},
        authorisationErr: {
          message: 'error message',
          error_description: 'error description',
          state: ''
        },
        config: {
          appDomain: 'https://app.domain',
          disallowedRedirectPath: '/disallowed-redirect-path'
        }
      }

      const routeMethods = RouteMethods({
        config: mock.config
      })

      const output = await routeMethods.handleAuthorisationError(mock.request, mock.h, mock.savedState, mock.authorisationErr)

      const querystring = (new URLSearchParams({
        errorMessage: mock.authorisationErr.message,
        errorDescription: mock.authorisationErr.error_description,
        state: ''
      }))

      expect(output).to.equal(`${mock.config.appDomain}${mock.config.disallowedRedirectPath}?${querystring}`)
    })
  })

  describe('handleValidatedToken', () => {
    it('should store our token and return a javascript redirect to the final redirect url', async () => {
      const passed = {
        cache: {
          state: null,
          request: null
        },
        preReturnPathRedirect: {
          request: null,
          h: null,
          tokenSet: null,
          backToPath: null
        }
      }

      const mock = {
        claims: {
          sub: Symbol('sub')
        },
        tokenSet: {
          claims: () => mock.claims
        },
        state: Symbol('state'),
        savedState: {
          backToPath: undefined
        },
        cache: {
          set: () => {},
          drop: async (state, request) => {
            passed.cache.state = state
            passed.cache.request = request
          }
        },
        config: {
          defaultBackToPath: '/default-back-to-path',
          appDomain: 'https://app.domain',
          callbacks: {
            preReturnPathRedirect: async (request, h, tokenSet, backToPath) => {
              passed.preReturnPathRedirect.request = request
              passed.preReturnPathRedirect.h = h
              passed.preReturnPathRedirect.tokenSet = tokenSet
              passed.preReturnPathRedirect.backToPath = backToPath
            }
          }
        },
        request: {
          cookieAuth: {
            set: () => {}
          }
        },
        h: {
          response: (response) => response
        }
      }

      const routeMethods = RouteMethods({
        config: mock.config,
        cache: mock.cache
      })

      const output = await routeMethods.handleValidatedToken(mock.request, mock.h, mock.state, mock.savedState, mock.tokenSet)

      expect(output).to.be.a.string()
      expect(passed.preReturnPathRedirect).to.equal({
        request: mock.request,
        h: mock.h,
        tokenSet: mock.tokenSet,
        backToPath: mock.config.defaultBackToPath
      })
      expect(passed.cache).to.equal({
        state: md5(mock.state),
        request: mock.request
      })
    })
  })

  describe('fullyQualifiedLocalPath', () => {
    const mockAppDomain = 'https://app.domain/'

    const { fullyQualifiedLocalPath } = RouteMethods({
      config: {
        appDomain: mockAppDomain
      }
    })

    it('should return the root url of the app if not passed a path', async () => {
      const mock = {
        path: undefined
      }

      const output = fullyQualifiedLocalPath(mock.path)

      expect(output).to.be.a.string()
      expect(output).to.equal(mockAppDomain)
    })

    it('should return a fully qualified url including the passed path', async () => {
      const mock = {
        path: 'just-a-path'
      }

      const output = fullyQualifiedLocalPath(mock.path)

      expect(output).to.be.a.string()
      expect(output).to.equal(`${mockAppDomain}${mock.path}`)
    })

    it('should return a fully qualified url including the passed path of a passed fully qualified url', async () => {
      const mockPath = 'just-a-path'

      const mock = {
        pathWithDomain: `https://another.domain/${mockPath}`
      }

      const output = fullyQualifiedLocalPath(mock.pathWithDomain)

      expect(output).to.be.a.string()
      expect(output).to.equal(`${mockAppDomain}${mockPath}`)
    })
  })
})
