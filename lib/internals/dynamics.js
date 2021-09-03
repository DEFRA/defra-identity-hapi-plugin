const debug = require('debug')('defra.identity:internals:dynamics')
const _ = require('lodash')
const querystring = require('querystring')
const MsalNode = require('@azure/msal-node')

module.exports = (
  {
    server,
    cache,
    config
  }) => {
  debug('Registering dynamics helpers...')

  let token = null

  const buildHeaders = async (headers = {}) => {
    const token = await getToken()

    return {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Prefer: 'odata.include-annotations="*"',
      ...headers
    }
  }

  const buildUrl = (endpoint, params) => {
    return config.dynamics.resourceUrl +
      config.dynamics.endpointBase +
      endpoint +
      (params ? '?' + querystring.stringify(params) : '')
  }

  const parseOptionalInteger = (input) => {
    try {
      return Number.parseInt(input)
    } catch (err) {
      return undefined
    }
  }

  const decodeResponse = (res) => {
    // First check the HTTP response
    if (!_.inRange(res.statusCode, 200, 300)) {
      debug(res)

      const message = `${res.request.path} - ${_.get(res, ['body', 'error', 'message'], res.statusMessage)}`

      throw new Error(message)
    }
    // Check for unexpected response format
    let decodedPayload = {}

    try {
      // DELETE has an empty response
      if (res.body) {
        if (typeof res.body === 'string') {
          decodedPayload = JSON.parse(res.body)
        } else if (typeof res.body === 'object') {
          decodedPayload = res.body
        }
      }
    } catch (err) {
      throw new Error(`Unrecognised JSON response from Dynamics: ${err.message}`)
    }

    // Check if there is a Dynamics error
    if (decodedPayload.error) {
      const errJson = decodedPayload.error
      // @todo Parse Dynamics response to say something more specific e.g. Duplicated record
      throw new Error(errJson.message)
    }

    // Finally return the Dynamics
    return decodedPayload
  }

  /**
   * Returns a bearer token for authentication to dynamics
   *
   * @return {Promise<string>}
   */
  const getToken = async () => {
    const now = new Date()

    if (!token || token.expiresOn < now) {
      await setNewToken()
    }

    return token.accessToken
  }

  const setNewToken = () => {
    return new Promise((resolve, reject) => {
      // Build URL scoping to the AAD tenant
      const authUrl = config.aad.authHost + '/' + config.aad.tenantName
      // Following credentials are for the AAD used to authenticate the B2C Dynamics
      const clientId = config.dynamics.clientId
      const clientSecret = config.dynamics.clientSecret
      const resourceUrl = config.dynamics.resourceUrl + '/.default'
      const context = new MsalNode.ConfidentialClientApplication({
        auth: {
          clientId: clientId,
          clientSecret: clientSecret,
          authority: authUrl,
          knownAuthorities: []
        }
      })
      const credentialRequest = {
        scopes: [resourceUrl]
        // azureRegion:"",
        // skipCache:true - think these are defualt options so leave them out for the time being as unnncessary
      }
      try {
        context.acquireTokenByClientCredential(credentialRequest).then((response) => {
          if (response.accessToken) {
            token = response
            resolve()
          } else {
            reject(new Error('Could not access Active Directory auth Token'))
          }
        }).catch((e) => {
          reject(new Error('Could not access Active Directory auth Token'))
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Accepts an object of roles and roleMappings and returns an containing formatted roles and mappings
   *
   * @param {Object<{roles: Array.<string>, roleMappings: Array.<string>}>} authzApiResponse
   * @return {null|Object}
   */
  const parseAuthzRoles = (authzApiResponse) => {
    const { roles, roleMappings } = authzApiResponse

    const byStatus = {}
    const byRole = {}
    const byOrg = {}
    const flat = []

    if (roles && roleMappings) {
      const parsedMappings = {}

      roleMappings.forEach(mapping => {
        const [id, name] = mapping.split(':')

        parsedMappings[id] = name
      })

      roles.forEach(role => {
        const [orgId, roleId, orgRoleStatusId] = role.split(':')

        const orgName = parsedMappings[orgId]
        const roleName = parsedMappings[roleId]
        const orgRoleStatusName = parsedMappings[orgRoleStatusId]
        const orgRoleStatusIdNumber = Number(orgRoleStatusId)

        const orgEnrolmentRecord = {
          id: roleId,
          name: roleName,
          status: {
            id: orgRoleStatusIdNumber,
            name: orgRoleStatusName
          }
        }

        // Make sure we have an object for this organisation in our roles object
        byOrg[orgId] = byOrg[orgId] || _blankParsedAuthzRecord(orgId, orgName)

        // Make sure we have an object for this status in our status roles object
        byStatus[orgRoleStatusIdNumber] = byStatus[orgRoleStatusIdNumber] || {}

        // Make sure we have an object for this organisation in our status roles object
        byStatus[orgRoleStatusIdNumber][orgId] = byStatus[orgRoleStatusIdNumber][orgId] || _blankParsedAuthzRecord(orgId, orgName)

        // Make sure we have an object for this role in our roles by role object
        byRole[roleId] = byRole[roleId] || {}

        // Make sure we have an object for this organisation in our status roles object
        // byRole[roleId][orgId] = byRole[roleId][orgId] || _blankParsedAuthzRecord(orgId, orgName)

        byRole[roleId][orgId] = orgEnrolmentRecord
        byStatus[orgRoleStatusIdNumber][orgId].roles[roleId] = orgEnrolmentRecord
        byOrg[orgId].roles[roleId] = orgEnrolmentRecord

        flat.push({
          roleId,
          roleName,
          orgId,
          orgName,
          orgRoleStatusIdNumber,
          orgRoleStatusName
        })
      })
    }

    return {
      rolesByOrg: byOrg,
      rolesByStatus: byStatus,
      rolesByRole: byRole,
      flat
    }
  }

  const _blankParsedAuthzRecord = (orgId, orgName) => {
    return {
      organisation: {
        id: orgId,
        name: orgName
      },
      roles: {}
    }
  }

  return {
    decodeResponse,
    buildHeaders,
    buildUrl,
    parseOptionalInteger,
    getToken,
    parseAuthzRoles
  }
}
