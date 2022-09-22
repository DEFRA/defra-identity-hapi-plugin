const Joi = require('joi')
/**
 * @property {string} identityAppUrl Url of the DEFRA identity app
 * @property {string} cookiePassword Password to encode cookie - should be 32 characters
 * @property {string} cookieName Name of cookie containing cache record identifier
 * @property {string} cacheSegment Name of the cache segment passed to the default in memory cache
 * @property {Boolean} passRequestToCacheMethods Whether to pass the request object as the last parameter to all cache methods
 * @property {?Object} cache Specify caching mechanism or leave blank to use memory cache
 * @property {Function} cache.get Async function accepting a cache key string
 * @property {Function} cache.set Async function accepting a cache key string, a value and a ttl
 * @property {Function} cache.drop Async function accepting a cache key string
 * @property {?number} cacheCookieTtlMs Cache ttl in ms - irrelevant if custom cache is specified above
 * @property {?string} disallowedRedirectPath Where to send users who are disallowed
 * @property {boolean} loginOnDisallow Automatically redirect to B2C when disallowed
 * @property {boolean} isSecure Is app being served securely - if true, only secure cookies will be set
 * @property {string} outboundPath Path of outbound redirect page
 * @property {string} redirectUri Path of return redirect page
 * @property {string|boolean} logoutPath Path of logout page - false if no log out page required
 * @property {string} appDomain Root domain the service can be found at - used for oidc return uri
 * @property {string} clientId B2C application id
 * @property {string} clientSecret B2C application secret
 * @property {?string} defaultPolicy Default B2C policy
 * @property {?string} defaultJourney Default Identity app journey
 * @property {boolean} onByDefault Turn on authentication requirement for all pages by default
 * @property {string} defaultBackToPath Default path to send users to when they are disallowed or after they have been authenticated
 * @property {?Object} callbacks Object of optional callbacks
 * @property {?Function} callbacks.preReturnPathRedirect Called when user is returned back from IdP - before user is redirected - if a truey value is returned, that will be returned to the client instead of the standard JS redirect. Takes request, h, tokenSet, backToPath
 * @property {?Function} callbacks.preLogout Called before the user is logged out - can be used to clear other persisted user data for example. Takes request, h
 * @property {?Function} callbacks.onError Called on uncaught error in routes exposed by plugin - First parameter is error. Request and h are also sometimes passed as params 2 and 3. If request & h are passed, a truey response from this function will be returned to the user
 * @property {string} postAuthenticationRedirectJsPath Where the post authentication redirect javascript snippet should be served from - avoids use of inline javascript
 * @property {string} defaultScope The default scope to authenticate the user against if no scope is passed at time of authentication
 * @property {number} retryDelayMultiplierSecs The multiplier in seconds of how long to wait between each failed operation that is retried e.g. first retry = 1.5 * 1 seconds delay. second retry = 1.5 * 2 seconds delay
 */
const schema = Joi.object({
  aad: Joi.object().keys({
    authHost: Joi.string().required(),
    tenantName: Joi.string().required()
  }).required(),
  dynamics: Joi.object().keys({
    clientId: Joi.string().required(),
    clientSecret: Joi.string().required().allow(''),
    resourceUrl: Joi.string().required(),
    endpointBase: Joi.string().required()
  }).required(),
  identityAppUrl: Joi.string().required(),
  serviceId: Joi.string().guid().required(),
  cookiePassword: Joi.string().min(32).required(),
  cookieName: Joi.string().required(),
  cacheSegment: Joi.string().required(),
  passRequestToCacheMethods: Joi.boolean().required(),
  cache: Joi.object().keys({
    get: Joi.func().maxArity(2),
    set: Joi.func().maxArity(4),
    drop: Joi.func().maxArity(2)
  }).optional().unknown(true),
  cacheCookieTtlMs: Joi.number().optional(),
  disallowedRedirectPath: Joi.string().required(),
  loginOnDisallow: Joi.boolean().required(),
  isSecure: Joi.boolean().required(),
  outboundPath: Joi.string().required(),
  redirectUri: Joi.string().required(),
  authRedirectUriFqdn: Joi.string().optional(),
  logoutPath: Joi.string().required().allow(false),
  appDomain: Joi.string().required(),
  clientId: Joi.string().guid().required(),
  clientSecret: Joi.string().required(),
  defaultPolicy: Joi.string().optional(),
  defaultJourney: Joi.string().optional(),
  onByDefault: Joi.boolean().required(),
  defaultBackToPath: Joi.string().required(),
  callbacks: Joi.object().keys({
    preReturnPathRedirect: Joi.func().maxArity(4).optional(),
    preLogout: Joi.func().maxArity(2).optional(),
    onError: Joi.func().maxArity(3).optional()
  }).required(),
  postAuthenticationRedirectJsPath: Joi.string().required(),
  defaultScope: Joi.string().required(),
  retryDelayMultiplierSecs: Joi.number().required()
})

module.exports = schema
