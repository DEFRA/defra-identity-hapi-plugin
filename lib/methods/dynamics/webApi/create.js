const Hoek = require('@hapi/hoek')
const debug = require('debug')('defra.identity:methods:dynamics:webApi:create')
const got = import('got')

module.exports = (
  {
    server,
    cache,
    config,
    internals
  }) => {
  debug('Registering dynamics create methods...')

  const {
    buildHeaders,
    buildUrl,
    decodeResponse
  } = internals.dynamics

  /**
   * @param {string} contactId dynamics contact guid
   * @param {string} connectionDetailsId dynamics connection detail guid
   * @param {string} enrolmentStatus dynamics enrolment status id - mappings.enrolmentStatus
   * @param {string} [organisationAccountId] dynamics organisation account guid
   * @param {string} [lobServiceId] dynamics service guid
   * @param {string} [lobServiceRoleId] dynamics line of business service role guid
   * @param {boolean} [verified=false] boolean indicating whether the connection has been verified or not
   * @returns {Promise<Object>}
   */
  const createEnrolment = async (contactId, connectionDetailsId, enrolmentStatus, organisationAccountId = undefined, lobServiceId = undefined, lobServiceRoleId = undefined, verified = false) => {
    const request = await createEnrolment.buildRequest(contactId, connectionDetailsId, enrolmentStatus, organisationAccountId, lobServiceId, lobServiceRoleId, verified)

    return got(request).then(decodeResponse)
  }

  createEnrolment.buildRequest = async (contactId, connectionDetailsId, enrolmentStatus, organisationAccountId = undefined, lobServiceId = undefined, lobServiceRoleId = undefined, verified = false) => {
    Hoek.assert(lobServiceRoleId || lobServiceId, 'Either lobServiceRoleId or lobServiceId should be supplied')

    const payload = {
      'defra_connectiondetail@odata.bind': `/defra_connectiondetailses(${connectionDetailsId})`,
      'defra_ServiceUser@odata.bind': `/contacts(${contactId})`,
      defra_enrolmentstatus: enrolmentStatus,
      defra_verified: verified
    }

    if (organisationAccountId) {
      payload['defra_Organisation@odata.bind'] = `/accounts(${organisationAccountId})`
    }

    if (lobServiceRoleId) {
      payload['defra_ServiceRole@odata.bind'] = `/defra_lobserivceroles(${lobServiceRoleId})`
    }

    if (lobServiceId) {
      payload['defra_service@odata.bind'] = `/defra_lobservices(${lobServiceId})`
    }

    const url = buildUrl('/defra_lobserviceuserlinks')
    const headers = await buildHeaders({
      Prefer: 'return=representation'
    })

    return {
      method: 'POST',
      url,
      headers,
      json: payload
    }
  }

  return {
    createEnrolment
  }
}
