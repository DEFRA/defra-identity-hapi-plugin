const debug = require('debug')('defra.identity:internals:routes')
const { URL, URLSearchParams } = require('url')
const { v4: uuid } = require('uuid')
const _ = require('lodash')
const md5 = require('md5')

module.exports = (
  {
    server,
    cache,
    config,
    constants
  }) => {
  const e = {}

  /**
  * @description Pulls the claims out of the token if they're stored in a function
  */
  e.sanitiseTokenSet = (tokenSet) => {
    tokenSet.claims = typeof tokenSet.claims === 'function' ? tokenSet.claims() : tokenSet.claims

    return tokenSet
  }

  e.storeTokenSetResponse = async (request, tokenSet) => {
    const defaultValue = uuid()
    const cacheKey = _.get(request, ['state', config.cookieName, 'cacheKey'], defaultValue)

    const sanitisedTokenSet = e.sanitiseTokenSet(tokenSet)

    await cache.set(cacheKey, {
      tokenSet: sanitisedTokenSet,
      claims: sanitisedTokenSet.claims
    }, undefined, request)

    request.cookieAuth.set({
      cacheKey
    })
  }

  e.handleAuthorisationError = async (request, h, savedState, authorisationErr) => {
    const {
      message: errorMessage,
      error_description: errorDescription,
      state
    } = authorisationErr

    let {
      disallowedRedirectPath
    } = savedState

    if (!disallowedRedirectPath) {
      disallowedRedirectPath = config.disallowedRedirectPath
    }

    const errorRedirectUrl = new URL(e.fullyQualifiedLocalPath(disallowedRedirectPath))

    errorRedirectUrl.search = (new URLSearchParams({
      ...errorRedirectUrl.query, // Maintain any existing query parameters
      errorMessage,
      errorDescription,
      state
    })).toString()

    debug({ authorisationErr })

    return h.redirect(errorRedirectUrl.toString())
  }

  e.handleValidatedToken = async (request, h, state, savedState, tokenSet) => {
    const {
      defaultBackToPath
    } = config

    const {
      backToPath = defaultBackToPath
    } = savedState

    tokenSet.claims = typeof tokenSet.claims === 'function' ? tokenSet.claims() : tokenSet.claims

    debug('received and validated tokens %j', tokenSet)
    debug('validated id_token claims %j', tokenSet.claims)

    // Get rid of the cache entry containing our state details
    // We don't need it anymore now that authentication has been fulfilled
    await cache.drop(md5(state), request)

    // Store our token set response in our cache, with a reference to it in a cookie
    // @todo use the state uid to reference this cache entry - exposes sub id in its current guise
    await e.storeTokenSetResponse(request, tokenSet)

    if (config.callbacks.preReturnPathRedirect) {
      // Execute the callback passed into this plugin before redirecting
      const preReturnPathRedirectCbOutcome = await config.callbacks.preReturnPathRedirect(request, h, tokenSet, backToPath)

      // If callback returned truey, it could be a redirect or response - return this instead of redirecting
      if (preReturnPathRedirectCbOutcome) { return preReturnPathRedirectCbOutcome }
    }

    const fqBackToPathString = e.fullyQualifiedLocalPath(backToPath)

    // Workaround for chrome bug whereby cookies won't set a cookie when a 302 redirect is returned
    // https://github.com/hapijs/hapi-auth-cookie/issues/159
    // https://bugs.chromium.org/p/chromium/issues/detail?id=696204
    return h.response(
      `<input id="backToPath" type="hidden" value="${fqBackToPathString}" />
      <script type="application/javascript" src="${config.postAuthenticationRedirectJsPath}"></script>
      <noscript>
        <a href="${fqBackToPathString}">Please click here to continue</a>
      </noscript>`
    )
  }

  e.fullyQualifiedLocalPath = (path) => {
    path = path || ''

    const {
      appDomain
    } = config

    const urlObj = new URL(appDomain)
    const parsedPath = new URL(path, appDomain)

    urlObj.pathname = parsedPath.pathname
    urlObj.search = parsedPath.search

    return urlObj.toString()
  }

  return e
}
