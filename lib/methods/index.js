const Hoek = require('@hapi/hoek')
const { URL, URLSearchParams } = require('url')
const debug = require('debug')('defra.identity:methods')
const { v4: uuidv4 } = require('uuid')
const md5 = require('md5')

const registerDynamicsMethods = require('./dynamics')
const models = require('../models')

module.exports = (
  {
    server,
    cache,
    config,
    internals
  }) => {
  debug('Registering server methods...')

  /**
   * Gets the user's session credentials - i.e. refresh token, expiry times of credentials
   *
   * @param {object} request - hapi request object
   * @returns {object|Boolean}
   */
  const getCredentials = async (request) => {
    Hoek.assert(typeof request === 'object', 'request object must be passed to idm.getCredentials')

    let cacheKey

    try {
      cacheKey = request.state[config.cookieName].cacheKey
    } catch (e) {
      return false
    }

    if (!cacheKey) { return false }

    const cacheData = await cache.get(cacheKey, request)

    if (cacheData && typeof cacheData === 'object') {
      cacheData.isExpired = function () {
        const nowTimestamp = ((new Date()).getTime()) / 1000

        return !this.claims || (this.claims.exp < nowTimestamp)
      }
    }

    return cacheData
  }

  /**
   * Gets the user's claims
   *
   * @param {object} request - hapi request object
   * @returns {object|null}
   */
  const getClaims = async (request) => {
    Hoek.assert(typeof request === 'object', 'request object must be passed to idm.getClaims')

    const credentials = await getCredentials(request)

    if (credentials) { return credentials.claims }

    return null
  }

  /**
   * Gets a url to the plugin's outboundPath
   *
   * @param {string} backToPath - Where to send the user after they have logged in
   * @param {object} obj
   * @param {string} obj.policyName - The name of the policy the user should be sent to in B2C
   * @param {string} obj.journey - The name of the policy the user should be sent to in the identity app
   * @param {Boolean} obj.forceLogin - Whether the user should be forced to log in or not - ignores whether they are already logged in at the IdP
   * @param {Boolean} obj.returnUrlObject - Whether to return a url object. By default returns the url as a string
   * @param {String} obj.state - Manually specify the state string to use
   * @param {String} obj.nonce - Manually specify the nonce string to use
   * @param {String} obj.scope - Manually specify the scope string to use
   * @param {String} obj._ga - Manually specify a cross site google analytics client id
   */
  const generateAuthenticationUrl = (backToPath, { policyName = '', journey = '', forceLogin = false, returnUrlObject = false, state = '', nonce = '', scope = '', _ga = undefined } = {}) => {
    backToPath = backToPath || config.defaultBackToPath

    const outboundUrl = new URL(config.appDomain)

    outboundUrl.pathname = config.outboundPath

    outboundUrl.search = (new URLSearchParams({
      backToPath,
      policyName,
      journey,
      forceLogin: forceLogin ? 'yes' : '',
      state,
      nonce,
      scope,
      _ga
    }).toString())

    if (returnUrlObject) { return outboundUrl }

    return outboundUrl.toString()
  }

  /**
   * Logs the user out
   *
   * @param {object} request - hapi request object
   */
  const logout = async (request) => {
    Hoek.assert(typeof request === 'object', 'request object must be passed to idm.logout')

    let cacheKey

    try {
      cacheKey = request.state[config.cookieName].cacheKey
    } catch (e) {}

    if (cacheKey) {
      await cache.drop(cacheKey, request)
    }

    request.cookieAuth.clear()
  }

  /**
   * Refreshes the user's JWT
   *
   * @param {object} request - hapi request object
   * @param {String} [contactId] - manually specify user's contact id in case it wasn't present in the original token
   * @param {Object} modules
   */
  const refreshToken = async (request, contactId, modules = { getCredentials }) => {
    const {
      getCredentials
    } = modules

    const existingCredentials = await getCredentials(request)
    const { claims } = existingCredentials

    const client = await internals.client.getClient({ policyName: claims.tfp || claims.acr })

    const refreshToken = existingCredentials.tokenSet.refresh_token

    const newTokenSet = await internals.root.retryable(() => client.refresh(refreshToken), internals.root.retryable.b2cRequestRetry)
    const refreshedTokenSet = internals.routes.sanitiseTokenSet(newTokenSet) // Extract the claims into an object that we can add our roles to

    // Use the contact id passed in, or the one returned in the refresh, or the one we originally had
    contactId = contactId || refreshedTokenSet.claims.contactId || existingCredentials.claims.contactId

    // We still won't have a contact id if they haven't completed registration yet
    if (contactId) {
      const serviceRoles = await server.methods.idm.dynamics.readServiceEnrolment(config.serviceId, contactId)

      refreshedTokenSet.claims.roles = serviceRoles.roles
      refreshedTokenSet.claims.roleMappings = serviceRoles.mappings

      // If our original token didn't have a contact id then our refreshed one won't either - stick the contact id back in
      if (!refreshedTokenSet.claims.contactId) {
        refreshedTokenSet.claims.contactId = contactId
      }
    }

    // @todo handle failed/rejected refresh
    await internals.routes.storeTokenSetResponse(request, refreshedTokenSet)

    debug('refreshed and validated tokens %j', refreshedTokenSet)
    debug('refreshed id_token claims %j', refreshedTokenSet.claims)
  }

  /**
   *
   * @param {Object} request - Hapi request object
   * @param {Object} config
   * @param {string} config.backToPath - Where to send the user after they have logged in
   * @param {string} config.policyName - The name of the policy the user should be sent to in B2C
   * @param {string} config.journey - The name of the journey the user should be sent to in the identity app
   * @param {Boolean|String} config.forceLogin - Whether the user should be forced to log in or not - ignores whether they are already logged in at the IdP
   * @param {?Object} options
   * @param {string} options.state Manually specify state
   * @param {Object} options.stateCacheData Manually specify state cache data
   * @param {String} options.redirectUri Manually specify redirect uri
   * @param {String} options.clientId Manually specify client id
   * @param {String} options.serviceId Manually specify consuming service id
   * @param {String} options.nonce Manually specify nonce
   * @param {String} options.scope Manually specify scope
   * @param {string} options.prompt - Manually set prompt
   * @returns {string}
   */
  const generateOutboundRedirectUrl = async (request, { backToPath = '', policyName = '', forceLogin = false, journey = '', _ga = undefined }, { state = '', stateCacheData = {}, redirectUri = '', clientId = '', serviceId = '', nonce = '', scope = '', prompt = '' } = {}) => {
    policyName = policyName || config.defaultPolicy
    journey = journey || config.defaultJourney
    state = state || uuidv4()
    redirectUri = redirectUri || config.redirectUriFqdn
    serviceId = serviceId || config.serviceId
    clientId = clientId || config.clientId
    scope = scope || config.defaultScope

    if (forceLogin === 'yes') {
      forceLogin = true
    }

    nonce = nonce || undefined

    stateCacheData = Hoek.applyToDefaults({
      policyName,
      forceLogin,
      backToPath,
      journey,
      nonce
    }, stateCacheData)

    // If our state is massively long, it could cause an error in cosmos db- hash it so we know it will be short enough
    await cache.set(md5(state), stateCacheData, undefined, request)

    const client = await internals.client.getClient({ policyName })

    const authorizationUrl = client.authorizationUrl({
      redirect_uri: redirectUri,
      scope,
      state,
      prompt: forceLogin ? 'login' : prompt || undefined,
      response_type: 'code',
      response_mode: 'form_post',
      client_id: clientId,
      policyName,
      journey,
      serviceId,
      nonce,
      _ga
    })

    return authorizationUrl
  }

  registerDynamicsMethods({ server, cache, config, internals })

  server.method('idm.getCredentials', getCredentials)
  server.method('idm.getClaims', getClaims)
  server.method('idm.generateAuthenticationUrl', generateAuthenticationUrl)
  server.method('idm.logout', logout)
  server.method('idm.refreshToken', refreshToken)
  server.method('idm.generateOutboundRedirectUrl', generateOutboundRedirectUrl)

  server.method('idm.getConfig', () => config)
  server.method('idm.getInternals', () => internals)
  server.method('idm.getCache', () => cache)
  server.method('idm.getModels', () => models)

  debug('Done registering server methods')
}
