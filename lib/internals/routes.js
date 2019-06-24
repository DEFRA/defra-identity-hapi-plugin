const debug = require('debug')('defra.identity:internals:routes')
const url = require('url')
const uuid = require('uuid/v4')
const _ = require('lodash')

module.exports = (
  {
    server,
    cache,
    config,
    constants
  }) => {
  const e = {}

  e.storeTokenSetResponse = async (request, tokenSet) => {
    const defaultValue = uuid()
    const cacheKey = _.get(request, ['state', config.cookieName, 'cacheKey'], defaultValue)

    await cache.set(cacheKey, {
      tokenSet,
      claims: tokenSet.claims
    }, undefined, request)

    request.cookieAuth.set({
      cacheKey
    })
  }

  e.handleAuthorisationError = async (request, h, savedState, authorisationErr) => {
    const {
      message: errorMessage,
      error_description: errorDescription
    } = authorisationErr

    let state = ''
    if (authorisationErr && authorisationErr.state) {
      state = JSON.parse(authorisationErr.state)
    }

    let {
      disallowedRedirectPath
    } = savedState

    if (!disallowedRedirectPath) {
      disallowedRedirectPath = config.disallowedRedirectPath
    }

    const errorRedirectUrl = url.parse(e.fullyQualifiedLocalPath(disallowedRedirectPath))

    errorRedirectUrl.query = {
      ...errorRedirectUrl.query, // Maintain any existing query parameters
      errorMessage,
      errorDescription
    }

    if (state.length > 0) {
      errorRedirectUrl.query.state = state
    }

    debug({ authorisationErr })

    return h.redirect(errorRedirectUrl.format())
  }

  e.handleValidatedToken = async (request, h, state, savedState, tokenSet) => {
    const {
      defaultBackToPath
    } = config

    const {
      backToPath = defaultBackToPath
    } = savedState

    debug('received and validated tokens %j', tokenSet)
    debug('validated id_token claims %j', tokenSet.claims)

    // Get rid of the cache entry containing our state details
    // We don't need it anymore now that authentication has been fulfilled
    await cache.drop(state, request)

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

    const urlObj = url.parse(appDomain)
    const parsedPath = url.parse(path)
    urlObj.pathname = parsedPath.pathname
    urlObj.search = parsedPath.search

    return url.format(urlObj)
  }

  return e
}
