## Changelog

- v2.1.3

  - Export all internals. Contribution by @bkniffler https://github.com/mcampa/trpc-to-openapi/pull/44
  - CVE fixes by running npm audit fix.

- v2.1.2

   - bug fix: remove lodash.cloneDeep from the build output

- v2.1.1 (bad build, do not use)

  - chore: remove lodash.cloneDeep and update some dependencies

- v2.1.0

  - Updated the minimum version of `zod-openapi` to 4.1.0.
  - Changed `zod-openapi` to a peer dependency.
  - The `protect` option now defaults to `true`.
  - Improved Error schema titles

- v2.0.4

  - Upgraded to tRPC 11.0.0-rc.648.

- v2.0.3

  - Added support for array inputs in GET requests.
