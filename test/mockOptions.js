const { v4: uuid } = require('uuid')

const url = () => `https://${uuid()}.com`

module.exports = {
  aad: {
    authHost: uuid(),
    tenantName: uuid()
  },
  dynamics: {
    clientId: uuid(),
    clientSecret: uuid(),
    resourceUrl: url(),
    endpointBase: uuid()
  },
  identityAppUrl: url(),
  serviceId: uuid(),
  cookiePassword: uuid(),
  cookieName: uuid(),
  cacheSegment: uuid(),
  passRequestToCacheMethods: false,
  cacheCookieTtlMs: 999999,
  disallowedRedirectPath: uuid(),
  loginOnDisallow: false,
  isSecure: false,
  outboundPath: uuid(),
  redirectUri: uuid(),
  logoutPath: uuid(),
  appDomain: url(),
  clientId: uuid(),
  clientSecret: uuid(),
  defaultPolicy: uuid(),
  defaultJourney: uuid(),
  onByDefault: true,
  defaultBackToPath: uuid(),
  postAuthenticationRedirectJsPath: uuid(),
  defaultScope: uuid(),
  retryDelayMultiplierSecs: 5
}
