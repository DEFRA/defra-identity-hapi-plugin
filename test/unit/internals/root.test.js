const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const { v4: uuid } = require('uuid')
const lab = exports.lab = Lab.script()

const { describe, it, beforeEach } = lab
const { expect } = Code

describe('Internals - root', () => {
  let mock
  let passed
  let outcome
  let rootMethods
  const retryDelayMultiplierSecs = 3

  beforeEach(() => {
    rootMethods = require('../../../lib/internals/root')({
      config: { retryDelayMultiplierSecs }
    })
  })

  describe('redirectTo', () => {
    let redirectTo

    beforeEach(() => {
      passed = {
        generateAuthenticationUrl: {
          path: null
        }
      }

      mock = {
        authenticationUrl: uuid(),
        request: {
          path: uuid()
        },
        server: {
          methods: {
            idm: {
              generateAuthenticationUrl: (path) => {
                passed.generateAuthenticationUrl.path = path

                return mock.authenticationUrl
              }
            }
          }
        }
      }

      redirectTo = rootMethods.redirectTo(true, uuid(), mock.server)

      outcome = redirectTo(mock.request)
    })

    it('should be a function', () => expect(redirectTo).to.be.a.function())
    it('should expect 1 argument', () => expect(redirectTo.length).to.equal(1))

    it('should generate an authentication url', () => expect(passed.generateAuthenticationUrl.path).to.equal(mock.request.path))
    it('should return the authentication url', () => expect(outcome).to.equal(mock.authenticationUrl))
  })

  describe('validateFunc', () => {
    let validateFunc

    beforeEach(async () => {
      passed = {
        getCredentials: {
          request: null
        },
        isExpired: {
          called: null
        }
      }

      mock = {
        credentials: {
          isExpired: () => {
            passed.isExpired.called = true

            return false
          }
        },
        server: {
          methods: {
            idm: {
              getCredentials: (request) => {
                passed.getCredentials.request = request

                return mock.credentials
              }
            }
          }
        }
      }

      validateFunc = rootMethods.validateFunc(mock.server)

      outcome = await validateFunc(mock.request)
    })

    it('should be a function', () => expect(validateFunc).to.be.a.function())
    it('should expect 1 argument', () => expect(validateFunc.length).to.equal(1))

    it('should fetch the user\'s credentials', () => expect(passed.getCredentials.request).to.equal(mock.request))
    it('should check to see if the user\'s credentials have expired', () => expect(passed.isExpired.called).to.be.true())
    it('should return an object indicating whether the user is authenticated', () => expect(outcome).to.equal({
      valid: true,
      credentials: mock.credentials
    }))
  })

  describe('retryable', () => {
    let outcome
    let mock
    let passed

    beforeEach(() => {
      passed = {
        onResponse: {
          err: null,
          response: null,
          iterationCount: null,
          retry: null,
          doNotRetry: null
        },
        delay: {
          ms: []
        },
        execution: {
          executionCount: 0
        }
      }

      mock = {
        toExecute: () => new Promise((resolve, reject) => {
          passed.execution.executionCount++

          if (mock.executionOutcome.err) {
            return reject(mock.executionOutcome.err)
          }

          return resolve(mock.executionOutcome.response)
        }),
        executionOutcome: {
          err: undefined,
          response: undefined
        }
      }
    })

    describe('Retryable', () => {
      describe('when an error is not thrown from the execution', () => {
        beforeEach(async () => {
          mock.executionOutcome.err = null
          mock.executionOutcome.response = Symbol('response')

          outcome = await rootMethods.retryable(mock.toExecute, (err, response, iterationCount, retry, doNotRetry) => {
            passed.onResponse.err = err
            passed.onResponse.response = response
            passed.onResponse.iterationCount = iterationCount
            passed.onResponse.retry = retry
            passed.onResponse.doNotRetry = doNotRetry

            if (iterationCount === 2) {
              return doNotRetry()
            }

            return retry()
          })
        })

        it('should return the outcome of toExecute', () => expect(outcome).to.equal(mock.executionOutcome.response))
        it('should pass an err parameter of undefined to the onResponse handler', () => expect(passed.onResponse.err).to.be.undefined())
        it('should pass the response to the onResponse handler', () => expect(passed.onResponse.response).to.equal(mock.executionOutcome.response))
        it('should pass the correct iteration count to the onResponse handler', () => expect(passed.onResponse.iterationCount).to.equal(2))
        it('should pass a retry function to the onResponse handler', () => expect(passed.onResponse.retry).to.be.a.function())
        it('should pass a doNotRetry function to the onResponse handler', () => expect(passed.onResponse.doNotRetry).to.be.a.function())
      })

      describe('when an error is thrown from toExecute', () => {
        beforeEach(async () => {
          mock.executionOutcome.err = Error('mock error')
          mock.executionOutcome.response = Symbol('request response')

          outcome = await rootMethods.retryable(mock.toExecute, (err, response, iterationCount, retry, doNotRetry) => {
            passed.onResponse.err = err
            passed.onResponse.response = response
            passed.onResponse.iterationCount = iterationCount
            passed.onResponse.retry = retry
            passed.onResponse.doNotRetry = doNotRetry

            if (iterationCount === 2) {
              return doNotRetry()
            }

            return retry()
          })
        })

        it('should pass the err to the onResponse handler', () => expect(passed.onResponse.err).to.equal(mock.executionOutcome.err))
        it('should pass a response parameter of undefined to the onResponse handler', () => expect(passed.onResponse.response).to.be.undefined())
        it('should pass the correct iteration count to the onResponse handler', () => expect(passed.onResponse.iterationCount).to.equal(2))
        it('should pass a retry function to the onResponse handler', () => expect(passed.onResponse.retry).to.be.a.function())
        it('should pass a doNotRetry function to the onResponse handler', () => expect(passed.onResponse.doNotRetry).to.be.a.function())
      })
    })

    describe('B2C request retry callback', () => {
      let passed

      beforeEach(() => {
        passed = {
          retry: {
            ms: undefined
          }
        }

        mock = {
          doNotRetrySymbol: Symbol('do not retry'),
          retrySymbol: Symbol('retry'),
          callbacks: {
            retry: (ms) => {
              passed.retry.ms = ms

              return mock.retrySymbol
            },
            doNotRetry: () => mock.doNotRetrySymbol
          }
        }
      })

      describe('when a valid response is returned', () => {
        let outcome
        let executionOutcome
        beforeEach(() => {
          executionOutcome = true

          outcome = rootMethods.retryable.b2cRequestRetry(null, executionOutcome, 3, mock.callbacks.retry, mock.callbacks.doNotRetry)
        })

        it('should not retry', () => expect(outcome).to.equal(mock.doNotRetrySymbol))
      })

      describe('when a retry after header is found in the response', () => {
        [1, 2].forEach(iteration => {
          describe(`and the iteration count is ${iteration}`, () => {
            let outcome
            let executionOutcome
            beforeEach(() => {
              executionOutcome = {
                headers: {
                  'Retry-After': 123
                }
              }

              outcome = rootMethods.retryable.b2cRequestRetry(null, executionOutcome, iteration, mock.callbacks.retry, mock.callbacks.doNotRetry)
            })

            it('should retry', () => expect(outcome).to.equal(mock.retrySymbol))
            it('should retry after the specified Retry-After time', () => expect(passed.retry.ms).to.equal(executionOutcome.headers['Retry-After'] * 1000))
          })
        })

        describe('and the iteration limit is hit', () => {
          let outcome
          let executionOutcome
          beforeEach(() => {
            executionOutcome = {
              headers: {
                'Retry-After': 123
              }
            }

            try {
              outcome = rootMethods.retryable.b2cRequestRetry(null, executionOutcome, 3, mock.callbacks.retry, mock.callbacks.doNotRetry)
            } catch (e) {
              outcome = e
            }
          })

          it('should throw an error', () => expect(outcome).to.be.an.error())
          it('should not retry', () => expect(passed.retry.ms).to.be.undefined())
        })
      })

      describe('when an error is thrown', () => {
        [1, 2].forEach(iteration => {
          describe(`and the iteration count is ${iteration}`, () => {
            let outcome
            let executionErr
            let executionErrMessage
            beforeEach(() => {
              executionErrMessage = uuid()
              executionErr = new Error(executionErrMessage)

              outcome = rootMethods.retryable.b2cRequestRetry(executionErr, null, iteration, mock.callbacks.retry, mock.callbacks.doNotRetry)
            })

            it('should retry', () => expect(outcome).to.equal(mock.retrySymbol))
            it('should retry after the iteration multiplied by the delay multiplier', () => expect(passed.retry.ms).to.equal((iteration * retryDelayMultiplierSecs) * 1000))
          })
        })

        describe('and the iteration limit is hit', () => {
          let outcome
          let executionErr
          let executionErrMessage
          beforeEach(() => {
            executionErrMessage = uuid()
            executionErr = new Error(executionErrMessage)

            try {
              outcome = rootMethods.retryable.b2cRequestRetry(executionErr, null, 3, mock.callbacks.retry, mock.callbacks.doNotRetry)
            } catch (e) {
              outcome = e
            }
          })

          it('should throw an error', () => expect(outcome).to.be.an.error())
          it('should throw the correct error message', () => expect(outcome.message).to.equal(executionErrMessage))
          it('should not retry', () => expect(passed.retry.ms).to.be.undefined())
        })
      })
    })
  })
})
