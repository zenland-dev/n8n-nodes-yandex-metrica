# Changelog

## 0.0.5

First release, and deliberately numbered below 0.1.0: nothing here has been run against a
live counter yet. 87 operations across 17 resources of the Yandex Metrica API, written from
scratch against Yandex's own documentation. Build, lint and `npm pack` are clean, and the
node loads, but every request shape comes from the documentation rather than from a reply.
Treat 0.0.5 as something to try against a test counter, not to put under a production
workflow. 0.1.0 will be the version that has been.

- Reports: table, by time, drill down, pivot, and both comparison methods, with the parallel
  arrays the API returns flattened into named fields.
- Logs API: create, evaluate, read, download and the two ways a request ends. Download parses
  the TSV into rows, or hands over the file.
- Counter management: counters, labels, goals, segments, filters, operations, annotations and
  access grants.
- Data import: offline conversions, calls, chats, advertising costs, visitor parameters, and
  CRM contacts and orders through the CDP API.
- Measurement Protocol: sending events, and reading or minting the per-counter token they need.
- Two credential types, a pasted token and full OAuth2, both pinned out of the HTTP Request
  node. Account quotas are enforced in the transport rather than discovered at run time.
