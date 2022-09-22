const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const { v4: uuid } = require('uuid')
const lab = exports.lab = Lab.script()

const { describe, it, beforeEach } = lab
const { expect } = Code

describe('Dynamics - create', () => {
  let mock
  let passed
  let create
  let outcome

  beforeEach(() => {
    passed = {
      buildUrl: {
        path: null
      },
      buildHeaders: {
        headers: null
      }
    }

    mock = {
      contactId: uuid(),
      connectionDetailsId: uuid(),
      enrolmentStatus: uuid(),
      organisationAccountId: uuid(),
      lobServiceId: uuid(),
      lobServiceRoleId: uuid(),
      builtHeaders: Symbol('built headers'),
      builtPath: Symbol('built path'),
      internals: {
        dynamics: {
          buildHeaders: async (headers) => {
            passed.buildHeaders.headers = headers

            return mock.builtHeaders
          },
          buildUrl: (path) => {
            passed.buildUrl.path = path

            return mock.builtPath
          }
        }
      }
    }

    const Create = require('../../../../../lib/methods/dynamics/webApi/create')

    create = Create({ internals: mock.internals })
  })

  describe('Create enrolment', () => {
    beforeEach(async () => {
      outcome = await create.createEnrolment.buildRequest(mock.contactId, mock.connectionDetailsId, mock.enrolmentStatus, mock.organisationAccountId, mock.lobServiceId, mock.lobServiceRoleId)
    })

    it('should build the url', () => expect(passed.buildUrl.path).to.equal('/defra_lobserviceuserlinks'))
    it('should build the headers', () => expect(passed.buildHeaders.headers).to.equal({
      Prefer: 'return=representation'
    }))
    it('should return an object containing request information', () => expect(outcome).to.equal({
      method: 'POST',
      url: mock.builtPath,
      headers: mock.builtHeaders,
      json: {
        'defra_Organisation@odata.bind': `/accounts(${mock.organisationAccountId})`,
        'defra_connectiondetail@odata.bind': `/defra_connectiondetailses(${mock.connectionDetailsId})`,
        'defra_ServiceUser@odata.bind': `/contacts(${mock.contactId})`,
        defra_enrolmentstatus: mock.enrolmentStatus,
        defra_verified: false,
        'defra_ServiceRole@odata.bind': `/defra_lobserivceroles(${mock.lobServiceRoleId})`,
        'defra_service@odata.bind': `/defra_lobservices(${mock.lobServiceId})`
      }
    }))
  })
})
