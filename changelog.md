# Change log

All notable changes to this project will be documented in this file.

## 5.10 - 16 Aug 2021
- CIDM - 2399
  - NPM audit fixes - updated to last version of adal-node (now deprected) , gulp will not be updated
## 5.2.8 - 31 Mar 2021
- Update tests for clock_tolerance setting

## 5.2.7 - 22 Mar 2021
- Update clock_tolerance setting

## 5.2.6 - 3 Mar 2021
- CIDM-2176
  - Add ability to be able to pass a _ga parameter into the outbound url generation mechanisms to facilitate cross site tracking 

## 5.2.5 - 14 Jan 2021
- CIDM-1982
  - Add ability to suppress login screen if user already has a valid session on the identity provider

## 5.2.4 - 1 Dec 2020
- CIDM-1865 - Fix to refreshing enrolments and storing them in claims

## 5.2.3 - 6 Oct 2020
- CIDM-1468
  - Retry failed B2C requests - only throw error after iteration limit is hit
  - Upgrade openid-client to latest version
  - NPM audit fixes

## 5.2.2 - 12 Jun 2020
- CIDM-946
  - Split large queries into chunks to prevent exceeding the max querystring size and prevent dynamics receiving a single large request
 
## 5.2.1 - 5 Jun 2020
- CIDM-947
  - Removed reference to odata.maxpagesize as this was restricting results to 500 records

## 5.2.0 - 2 Apr 2020
- CIDM-587
  - Update existing and add new tests
  - Remove unused mappings
  - Replace request with got
  - Github workflow to push to npm on merge to master branch

## 5.1.0 - 10 Mar 2020
- CIDM-513 - Split demo service into its own repo

## 5.0.0 - 2 Mar 2020
- CIDM-518 - Upgrade to Hapi 19 compatibility

## 4.1.10 - 29 Jan 2020
- CIDM-389 - Fix to pass correctly hashed state to cache drop function

## 4.1.9 - 19 Sept 2019
- IDM-2625
  - Addition of EnrolmentRequest read functionality
  - Implement models directory with EnrolmentRequest model

## 4.1.8 - 25 Jul 2019
- Npm audit fixes

## 4.1.7 - 28 Jun 2019
- IDM-1980 - Add the state information from B2C to the authorisation error handler

## 4.1.4 - 14 Jun 2019
- IDM-2135 - Fix to refreshing the token for the second time since registration

## 4.1.1 - 25 Apr 2019
- IDM-1727 - Update entity path when getting cacheKey from request's state

## 4.1.0 - 10 Apr 2019
- IDM-1919 - Add deactivateEnrolment functionality

## 4.0.5 - 3 Apr 2019
- CPII-285 - Use existing cache record key if one exists

## 4.0.4 - 3 Apr 2019
- CPII-285 - Use a random string for cache record key

## 4.0.3 - 20 Mar 2019
- IDM-1789 - Fix to the creation of a fully qualified domain when redirecting

## 4.0.2 - 11 Mar 2019
- Ensure that redirects after logging out are always to the same domain as the consuming service

## 4.0.1 - 11 Mar 2019
- Set sameSite cookie policy to 'Lax' - https://www.owasp.org/index.php/SameSite

## 4.0.0 - 14 Feb 2019
- `idm.dynamics.parseAuthzRoles` will not return `null` if there are no roles - it will always return an object
  - Also will now deduplicate roles, orgs, enrolment statuses
- `idm.dynamics.createEnrolment` uses the native dynamics api
  - The signature has changed as a result
  - No longer need to create role as "pending" before setting it to "complete" - can set to complete status straight away
- `idm.dynamics.readEnrolment` supports the retrieval of enrolments by serviceId
  - Also supports a flag to indicate whether to return all enrolments for a service - regardless of whether there is a service role associated with it
  - The signature has changed as a result
- `idm.dynamics.readServiceEnrolment` supports handshake enrolments - enrolments without a service role
  - Parameter serves as flag to indicate whether to include them

## 3.0.0 - 19 Dec 2018
- Remove readContactsEmployerLinks and readContactsAgentCustomerLinks in favour of readContactsAccountLinks
  - By default, reads links of type: employee, agentCustomer and citizen but accepts overrides for types of roles queried
  - Allows for easy enrolment of citizen accounts
  - Updates to demo to suit the above
- Remove readContactIdFromB2cObjectId - No longer needed now that contact id is passed back in the token

## 2.6.0 - 18 Dec 2018
- Add functionality to override scope
- Allows an access token to be passed back to the relying party

## 2.5.0 - 21 Nov 2018
- Fix all npm audit vulnerabilities
- Added changelog.md

Packages updated to latest versions:
- openid-client
- gulp
- sonarqube-scanner

## 2.4.2 - 16 Nov 2018
Allow array of serviceIds in dynamics.readServiceRoles

## 2.4.1 - 16 Nov 2018
Only query active enrolments in dynamics.readEnrolment

## 2.4.0 - 16 Nov 2018
Hash the state stored when sending a user to identity provider - If our state is massively long, it could cause an error in cosmos db - hash it so we know it will be short enough

## 2.3.5 - 12 Nov 2018
Ensure backToPath is always a path on the app domain

## 2.3.3 - 9 Nov 2018
If request is needed for the cache, force get request on redirect uri - ensures the correct cookies will be available to the request

## 2.3.2 - 9 Nov 2018
Addition of dynamics.readContactsAgentCustomerLinks - Give service access to an 3rd party member service role - idm 671.3

## 2.3.1 - 7 Nov 2018
Migrate javascript redirect snippet to external javascript file

## 2.3.0 - 7 Nov 2018
Add option to pass request object to cache methods - makes it possible to use cookies for caching

## 2.2.9 - 16 Nov 2018
Read service roles function to work with multiple service ids

## 2.2.8 - 6 Nov 2018
Send more useful error message to error page in query string when error retrieving state on user's return

## 2.2.5 - 24 Oct 2018
Identity App integration
