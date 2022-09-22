const Hoek = require('@hapi/hoek')
const { URL } = require('url')
const debug = require('debug')('defra.identity:config')

const configDefaults = require('./defaults')
const configSchema = require('./schema')

const createConfig = options => {
  debug('Creating config options')

  const config = Hoek.applyToDefaults(configDefaults, options)

  const validated = configSchema.validate(config)

  Hoek.assert(!validated.error, validated.error)

  const { appDomain } = options

  const redirectUri = new URL(appDomain)

  redirectUri.pathname = config.redirectUri

  config.redirectUriFqdn = redirectUri.toString()

  debug('Config options created')

  return config
}

const createCache = (passRequestToCacheMethods, specifiedCache) => ({
  async get (key, request) {
    if (passRequestToCacheMethods) {
      return specifiedCache.get(key, request)
    } else {
      return specifiedCache.get(key)
    }
  },
  async set (key, value, ttl, request) {
    if (passRequestToCacheMethods) {
      return specifiedCache.set(key, value, ttl, request)
    } else {
      return specifiedCache.set(key, value, ttl)
    }
  },
  async drop (key, request) {
    if (passRequestToCacheMethods) {
      return specifiedCache.drop(key, request)
    } else {
      return specifiedCache.drop(key)
    }
  }
})

module.exports = {
  createConfig,
  createCache
}
