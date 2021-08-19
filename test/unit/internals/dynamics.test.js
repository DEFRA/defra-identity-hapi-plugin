const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const uuid = require('uuid/v4')
const td = require('testdouble')
const lab = exports.lab = Lab.script()

const { describe, it, beforeEach, afterEach } = lab
const { expect } = Code

describe('Internals - dynamics', () => {
  let passed
  let mock
  let outcome
  let Module
  let dynamics
  const resourceUrlUUID = uuid()
  const _setTestVars = () => {
    passed = {}

    mock = {
      args: {
        config: {
          dynamics: {
            resourceUrl: resourceUrlUUID,
            endpointBase: uuid(),
            clientId: uuid(),
            clientSecret: uuid(),
            scopes: [resourceUrlUUID]// 'insertScopeHere.micosoft.com/comeBackLater']
          },
          aad: {
            authHost: uuid(),
            tenantName: uuid()
          }
        }
      },
      data: {},
      modules: {
        msalNode: {}
      }
    }

    outcome = undefined
    Module = undefined
    dynamics = undefined
  }

  const _doRequires = () => {
    td.replace('@azure/msal-node', mock.modules.msalNode)

    Module = require('../../../lib/internals/dynamics')
    dynamics = Module({ config: mock.args.config })
  }

  afterEach(td.reset)
  beforeEach(_setTestVars)

  describe('When the file is required', () => {
    describe('and the exported function is executed', () => {
      beforeEach(_doRequires)

      it('should export an object of functions', () => {
        expect(Object.keys(dynamics)).to.only.include([
          'buildHeaders',
          'buildUrl',
          'decodeResponse',
          'getToken',
          'parseAuthzRoles',
          'parseOptionalInteger'
        ])
      })
    })
  })

  describe('Token related functions', () => {
    beforeEach(() => {
      passed = {
        acquireTokenByClientCredential: {
          scopes: 'hallo'
        },
        ConfidentialClientApplication: {
          clientId: null,
          clientSecret: null,
          authUrl: null
        }
      }

      mock = {
        ...mock,
        data: {
          tokenResponse: {
            accessToken: uuid()
          }
        },
        modules: {
          msalNode: {
            ConfidentialClientApplication: class {
              constructor ({
                auth: {
                  clientId: clientIdDefined, // passed.ConfidentialClientApplication.clientId,
                  clientSecret: clientSecretDefined, // passed.ConfidentialClientApplication.clientSecret,
                  authority: authUrlDefined // passed.ConfidentialClientApplication.authUrl,
                }
              }) {
                passed.ConfidentialClientApplication.clientId = clientIdDefined
                passed.ConfidentialClientApplication.clientSecret = clientSecretDefined
                passed.ConfidentialClientApplication.authUrl = authUrlDefined
              }

              acquireTokenByClientCredential ({ scopes: scopesDefined }) {
                passed.acquireTokenByClientCredential.scopes = scopesDefined
                // passed.acquireTokenByClientCredential.returned = mock.data.tokenResponse
                /// console.log("Mock Data" +mock.data)
                return mock.data.tokenResponse
              }
            }

          }
        }
      }

      _doRequires()
    })

    describe('buildHeaders', () => {
      beforeEach(async () => {
        mock.data.headers = {
          testHeader: Symbol('test header')
        }

        outcome = await dynamics.buildHeaders(mock.data.headers)
      })

      it('should return an object containing correct headers', () => expect(outcome).to.equal({
        Authorization: 'Bearer ' + mock.data.tokenResponse.accessToken,
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json; charset=utf-8',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'odata.include-annotations="*"',
        ...mock.data.headers
      }))
    })

    describe('getToken', () => {
      beforeEach(async () => {
        outcome = await dynamics.getToken()
      })

      it('should instantiate an Confidential Client Application context', () => expect(passed.ConfidentialClientApplication.authUrl).to.equal(mock.args.config.aad.authHost + '/' + mock.args.config.aad.tenantName))
      it('should fetch the token using client credentials', () => {
        expect(passed.acquireTokenByClientCredential).to.include({
          scopes: mock.args.config.dynamics.scopes
        })
        // expect(passed.acquireTokenWithClientCredentials.next).to.be.a.function()
      })
      it('should return the access token', () => expect(outcome).to.equal(mock.data.tokenResponse.accessToken))
    })
  })

  describe('buildUrl', () => {
    beforeEach(() => {
      mock.data.endpoint = uuid()
      mock.data.params = {
        testParam: uuid()
      }

      _doRequires()

      outcome = dynamics.buildUrl(mock.data.endpoint, mock.data.params)
    })

    it('should return a formatted url', () => {
      const expected = mock.args.config.dynamics.resourceUrl +
        mock.args.config.dynamics.endpointBase +
        mock.data.endpoint +
        `?testParam=${mock.data.params.testParam}`

      expect(outcome).to.equal(expected)
    })
  })

  describe('decodeResponse', () => {
    describe('If the response has a status code outside 200-300', () => {
      beforeEach(() => {
        mock.args.response = {
          statusCode: 200,
          request: {
            path: uuid()
          },
          body: {
            error: {
              message: uuid()
            }
          }
        }

        _doRequires()
      })

      it('should throw an error', () => {
        // Cycle through status codes from 100-199
        // Once we hit 200, jump to 301 and continue until 999
        for (let statusCode = 100; statusCode < 999; statusCode = statusCode === 199 ? 301 : statusCode + 1) {
          mock.args.response.statusCode = statusCode

          try {
            outcome = dynamics.decodeResponse(mock.args.response)
          } catch (e) {
            outcome = e
          }

          expect(outcome).to.be.an.error()
          expect(outcome.message).to.include(mock.args.response.request.path)
          expect(outcome.message).to.include(mock.args.response.body.error.message)
        }
      })
    })

    describe('If the response has a success status code', () => {
      beforeEach(() => {
        mock.args.response = {
          statusCode: 200,
          body: {}
        }

        _doRequires()
      })

      describe('If the response has an empty body', () => {
        beforeEach(() => {
          outcome = dynamics.decodeResponse(mock.args.response)
        })

        it('should return an empty object', () => expect(outcome).to.equal({}))
      })

      describe('If the response has a valid json string body', () => {
        beforeEach(() => {
          mock.data.jsonResponse = { test: 'response' }
          mock.args.response.body = JSON.stringify(mock.data.jsonResponse)

          outcome = dynamics.decodeResponse(mock.args.response)
        })

        it('should return the decoded json', () => expect(outcome).to.equal(mock.data.jsonResponse))
      })

      describe('If the response has an invalid json string body', () => {
        beforeEach(() => {
          mock.args.response.body = 'invalid json'

          try {
            outcome = dynamics.decodeResponse(mock.args.response)
          } catch (e) {
            outcome = e
          }
        })

        it('should throw an error', () => expect(outcome).to.be.an.error())
        it('should include a relevant error message', () => expect(outcome.message).to.include('Unrecognised JSON response from Dynamics'))
      })

      describe('If the response body is an object', () => {
        beforeEach(() => {
          mock.args.response.body = { test: 'response' }

          outcome = dynamics.decodeResponse(mock.args.response)
        })

        it('should return the object body', () => expect(outcome).to.equal(mock.args.response.body))
      })
    })
  })

  describe('parseAuthzRoles', () => {
    beforeEach(() => {
      mock.data.orgs = [
        {
          id: 'orgid-' + uuid(),
          name: 'orgname-' + uuid()
        },
        {
          id: 'orgid-' + uuid(),
          name: 'orgname-' + uuid()
        }]
      mock.data.roles = [
        {
          id: 'roleid-' + uuid(),
          name: 'rolename-' + uuid()
        },
        {
          id: 'roleid-' + uuid(),
          name: 'rolename-' + uuid()
        }]
      mock.data.statuses = [
        {
          id: 123,
          name: 'statusid-' + uuid()
        },
        {
          id: 321,
          name: 'statusid-' + uuid()
        }]

      mock.args.authzApiResponse = {
        roles: [],
        roleMappings: []
      }

      mock.data.orgs.forEach((org, index) => {
        mock.args.authzApiResponse.roles.push([org.id, mock.data.roles[index].id, mock.data.statuses[index].id].join(':'))
        mock.args.authzApiResponse.roleMappings.push([org.id, org.name].join(':'))
        mock.args.authzApiResponse.roleMappings.push([mock.data.roles[index].id, mock.data.roles[index].name].join(':'))
        mock.args.authzApiResponse.roleMappings.push([mock.data.statuses[index].id, mock.data.statuses[index].name].join(':'))
      })

      _doRequires()

      outcome = dynamics.parseAuthzRoles(mock.args.authzApiResponse)
    })

    it('should return an object containing parsed roles in different formats', () => expect(Object.keys(outcome)).to.only.include([
      'rolesByOrg',
      'rolesByStatus',
      'rolesByRole',
      'flat'
    ]))

    it('should return roles grouped by organisation', () => {
      const { orgs, roles, statuses } = mock.data

      const expected = {
        [orgs[0].id]: {
          organisation: orgs[0],
          roles: {
            [roles[0].id]: {
              ...roles[0],
              status: statuses[0]
            }
          }
        },
        [orgs[1].id]: {
          organisation: orgs[1],
          roles: {
            [roles[1].id]: {
              ...roles[1],
              status: statuses[1]
            }
          }
        }
      }

      expect(outcome.rolesByOrg).to.equal(expected)
    })

    it('should return roles grouped by status', () => {
      const { orgs, roles, statuses } = mock.data

      const expected = {
        [statuses[0].id]: {
          [orgs[0].id]: {
            organisation: orgs[0],
            roles: {
              [roles[0].id]: {
                ...roles[0],
                status: statuses[0]
              }
            }
          }
        },
        [statuses[1].id]: {
          [orgs[1].id]: {
            organisation: orgs[1],
            roles: {
              [roles[1].id]: {
                ...roles[1],
                status: statuses[1]
              }
            }
          }
        }
      }

      expect(outcome.rolesByStatus).to.equal(expected)
    })

    it('should return roles grouped by role', () => {
      const { orgs, roles, statuses } = mock.data

      const expected = {
        [roles[0].id]: {
          [orgs[0].id]: {
            ...roles[0],
            status: statuses[0]
          }
        },
        [roles[1].id]: {
          [orgs[1].id]: {
            ...roles[1],
            status: statuses[1]
          }
        }
      }

      expect(outcome.rolesByRole).to.equal(expected)
    })

    it('should return a flat array of all roles', () => {
      const { orgs, roles, statuses } = mock.data

      expect(outcome.flat).to.equal([{
        roleId: roles[0].id,
        roleName: roles[0].name,
        orgId: orgs[0].id,
        orgName: orgs[0].name,
        orgRoleStatusIdNumber: statuses[0].id,
        orgRoleStatusName: statuses[0].name
      }, {
        roleId: roles[1].id,
        roleName: roles[1].name,
        orgId: orgs[1].id,
        orgName: orgs[1].name,
        orgRoleStatusIdNumber: statuses[1].id,
        orgRoleStatusName: statuses[1].name
      }])
    })
  })
})
