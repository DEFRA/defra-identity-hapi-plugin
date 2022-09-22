const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const { v4: uuid } = require('uuid')
const td = require('testdouble')
const lab = exports.lab = Lab.script()

const { describe, it, beforeEach, afterEach } = lab
const { expect } = Code

describe('Dynamics - create', () => {
  let mock
  let passed
  let dynamicsDelete
  let outcome

  afterEach(td.reset)

  beforeEach(() => {
    passed = {
      buildUrl: {
        path: null
      },
      buildHeaders: {
        headers: null
      },
      got: {
        options: null
      }
    }

    mock = {
      lobServiceUserLinkId: uuid(),
      decodedResponse: Symbol('decoded response'),
      builtHeaders: Symbol('built headers'),
      builtUrl: Symbol('built url'),
      internals: {
        dynamics: {
          buildHeaders: async (headers) => {
            passed.buildHeaders.headers = headers

            return mock.builtHeaders
          },
          buildUrl: (path) => {
            passed.buildUrl.path = path

            return mock.builtUrl
          },
          decodeResponse: () => mock.decodedResponse
        }
      },
      modules: {
        got: async (options) => {
          passed.got.options = options
        }
      }
    }

    td.replace('got', mock.modules.got)

    const Delete = require('../../../../../lib/methods/dynamics/webApi/delete')

    dynamicsDelete = Delete({ internals: mock.internals })
  })

  describe('deactiveEnrolment', () => {
    beforeEach(async () => {
      outcome = await dynamicsDelete.deactivateEnrolment(mock.lobServiceUserLinkId)
    })

    it('should build headers', () => expect(passed.buildHeaders.headers).to.equal(undefined))
    it('should built url', () => expect(passed.buildUrl.path).to.equal(`/defra_lobserviceuserlinks(${mock.lobServiceUserLinkId})/Microsoft.Dynamics.CRM.defra_deleteenrolment`))
    it('should make the request', () => expect(passed.got.options).to.equal({
      method: 'POST',
      url: mock.builtUrl,
      headers: mock.builtHeaders
    }))
    it('should return the decoded response', () => expect(outcome).to.equal(mock.decodedResponse))
  })
})
