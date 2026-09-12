# n8n-nodes-yandex-metrica

n8n community node for [Yandex Metrica](https://metrika.yandex.ru) — 87 operations across
17 resources, covering the report API, Logs API, counter management and every kind of data
import the service accepts.

Metrica is the web analytics most Russian-language sites run. Four different things live
behind one API and this node keeps them apart: reading aggregated numbers, downloading raw
visit rows, managing counters and their settings, and feeding back the facts the browser
never saw — an offline deal, a phone call, advertising spend, a CRM order.

Written from scratch against [Yandex's own API documentation](https://yandex.ru/dev/metrika/ru/).
No code from any other package.

> **0.0.5 has not been run against a live counter.** The version is numbered below 0.1.0 for
> exactly that reason. Build, lint and packaging are clean and the node loads, but every
> request shape here comes from the documentation rather than from a reply Metrica actually
> sent. Point it at a test counter, read what comes back, and open an issue for anything that
> disagrees. 0.1.0 will be the version that has been verified.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Scopes, and the error they cause](#scopes-and-the-error-they-cause)
- [Rate limits](#rate-limits)
- [Quirks worth knowing](#quirks-worth-knowing)
- [What is not here](#what-is-not-here)
- [Feedback and bugs](#feedback-and-bugs)

## Installation

In n8n: **Settings → Community nodes → Install**, then enter `n8n-nodes-yandex-metrica`.

Self-hosted, from the command line:

```bash
npm install n8n-nodes-yandex-metrica
```

Requires n8n 2.x and Node 20.19 or newer.

## Credentials

Two credential types, and they differ only in where the token comes from. Both reach the same
host with the same `Authorization: OAuth <token>` header, and both cover every operation.

**Yandex Metrica API** takes a token pasted in by hand. Create an application at
[oauth.yandex.ru](https://oauth.yandex.ru), tick `metrika:read` and `metrika:write`, open
`https://oauth.yandex.ru/authorize?response_type=token&client_id=<ID>` and copy the token out
of the address bar. Five minutes, no callback URL, works on an n8n nothing can reach from
outside. The token lives about a year and then stops without warning.

**Yandex Metrica OAuth2 API** runs the full flow. It needs the same application plus its
client secret, and an n8n reachable over HTTPS so Yandex can call the redirect back. In
exchange n8n renews the token by itself, which is the only reason to prefer it.

The counter is not part of either credential. One token opens every counter the account can
see, so the counter is picked per operation from a dropdown — which is what lets an agency
keep one credential and fifty clients.

Neither credential can be used inside an HTTP Request node. The token credential has no
`authenticate` block at all, so n8n never offers it there; the OAuth2 one pins *Allowed HTTP
Request Domains* to `none`, which is what stops the injected default of *All*.

## Operations

| Resource | Operations |
|---|---|
| **Report** | Get Table, Get By Time, Drill Down, Get Pivot, Compare Periods, Compare Drill Down |
| **Log** | Create, Evaluate, Get, Get Many, Download, Cancel, Clean |
| **Counter** | Create, Get, Get Many, Update, Delete, Attach Label, Detach Label, Create Label, Get Label, Get Many Labels, Update Label, Delete Label |
| **Goal** | Create, Get, Get Many, Update, Delete |
| **Segment** | Create, Get, Get Many, Update, Delete |
| **Filter** | Create, Get, Get Many, Update, Delete |
| **Operation** | Create, Get, Get Many, Update, Delete |
| **Annotation** | Create, Get, Get Many, Update, Delete |
| **Access** | Create, Get, Get Many, Get Own Access, Update, Delete, Enable Public Access, Disable Public Access |
| **Offline Conversion** | Upload, Get, Get Many |
| **Call** | Upload, Get, Get Many |
| **Chat** | Upload, Get, Get Many |
| **Advertising Cost** | Upload, Delete, Get, Get Many |
| **Visitor Parameter** | Upload, Confirm, Get, Get Many |
| **CRM Contact** | Upload, Get Uploadings, Get Attributes, Create Attributes |
| **CRM Order** | Upload, Upload Simplified, Map Statuses, Get Statuses, Create Products |
| **Event** | Send, Get Tokens, Generate Token |

A few notes that save a first attempt.

**Report** returns each row as named fields by default. The API itself answers with parallel
arrays — dimensions in one list, metrics in another, the names of those positions in a
separate `query` block — which nothing downstream can address. Turn **Simplify** off to get
the response untouched, with totals and sampling information.

**Log** is asynchronous. Create a request, wait, check the status with Get, then Download each
part. Nothing polls for you: put a Wait node in the loop.

**Event** is the Measurement Protocol. It goes to `mc.yandex.ru` with a per-counter token
rather than the OAuth header; leave the token field empty and the node reads an existing one
for that counter through the same credential.

## Scopes, and the error they cause

A Yandex token carries fixed permissions, chosen when the application was created, not when
this credential was filled in.

| Scope | Opens |
|---|---|
| `metrika:read` | Reading statistics and settings |
| `metrika:write` | Everything else, including every upload |
| `metrika:expenses` | Advertising costs only |
| `metrika:user_params` | Visitor parameters only |
| `metrika:offline_data` | CRM data, offline conversions, calls |

The last three are unnecessary when the token has `metrika:write`.

Here is the trap. A token issued with only `metrika:read` saves without complaint and the
**Test** button goes green, because the test only reads. The first upload then fails with
`Access is denied` and no mention of a scope. Worse, Metrica answers exactly the same way
when the account simply has no access to that counter. The node's error message says both
possibilities out loud, because the API will not tell you which it was.

Changing the application afterwards does not upgrade tokens it has already handed out. Reissue
the token.

## Rate limits

Every quota below is counted per **account**, across every integration signed in as it — not
per workflow and not per credential. One impatient node can lock out the rest.

| Limit | Value |
|---|---|
| Requests per second, one address | 30, and 10 for Logs API |
| Parallel requests per account | 3 |
| Requests per day per account | 5000, resetting at 00:00 UTC |
| Report calls per 5 minutes | 200 |
| Log storage per counter | 10 GB |

The node paces itself against all of these. The per-second and per-report budgets queue; the
daily one refuses instead, because 5000 requests reset at midnight UTC and a workflow parked
for eight hours reads as a hang rather than as a wait. Both ceilings are credential fields, so
lowering them is how you leave room for whatever else uses the same account.

## Quirks worth knowing

**Logs storage fills up and stays full.** A counter has 10 GB for prepared exports, downloading
does not free any of it, and there is no endpoint that reports the remaining space — the only
way to know is to sum the `size` field across Get Many. A workflow that creates log requests
and never runs **Clean** works for a while and then stops working for good. Clean is the last
step of the loop, not housekeeping.

**Measurement Protocol reaches back exactly 12 hours.** An event for a visit that ended
earlier is accepted with a normal answer and then discarded. Nothing in the response says so.
For anything older, use Offline Conversion instead. Metrica also only remembers a ClientID for
21 days after the feature is switched on, and an unknown ClientID silently becomes a new
visitor rather than the returning one you meant.

**A counter may hold at most five measurement tokens**, and there is no way to retire one
through the API. This node reads existing tokens rather than minting new ones, so **Generate
Token** is a deliberate operation you run once.

**Segments saved in the Metrica interface are invisible here.** The API returns only segments
created through the API — `segment_source: api` — so a segment made in the browser yesterday
will not appear in Get Many. That is the service's behaviour, not a gap in this node.

**Filters and operations are not undoable.** Both act at collection time. Traffic a filter
excludes is never stored, and an address an operation rewrote keeps no original. Create a
filter with **Status: Disabled** to stage it first.

**Visitor parameters do nothing until confirmed.** The upload lands in a pending state and a
separate **Confirm** call applies it. This is the step people forget.

**Contacts before orders.** A CRM order pointing at a contact that has not been uploaded is
accepted and then has nobody to attach to, which is the usual reason an end-to-end funnel
comes out empty. Map the order statuses too: until each of your CRM's statuses is mapped to
`IN_PROGRESS`, `PAID` or `CANCELLED`, no funnel can tell a won deal from a lost one.

**Dates are not ISO instants.** Reports take `YYYY-MM-DD` or Metrica's own words — `today`,
`yesterday`, `7daysAgo` — and the words are what keep a scheduled workflow correct across
timezones. CRM uploads want `YYYY-MM-DD HH:MM:SS`. Offline conversions want a Unix timestamp
in seconds. The fields say which is which.

**Today's data is incomplete.** Logs API refuses the current day outright, and about 1% of
visits are still being updated three days after they start, so a report ending `today` will
not match the same report run tomorrow.

## What is not here

Deliberately left out of this version, because there is nobody to automate them from n8n:
accounts, delegates, access filters, undeleting a counter, the client list, and the Yandex
Cloud export settings. Fifteen methods. Adding operations later is backwards compatible, so
say if you need one.

Yandex Audience, Yandex Direct, AppMetrica and Yandex Webmaster are separate services with
their own APIs. They are not in this package and will not be.

There is no trigger node. Metrica has no webhooks of any kind, so a trigger could only poll,
and a Schedule node in front of Report or Log does that already without pretending otherwise.

## Feedback and bugs

Open an issue at
[github.com/zenland-dev/n8n-nodes-yandex-metrica/issues](https://github.com/zenland-dev/n8n-nodes-yandex-metrica/issues).
A workflow export with the credential removed, and the exact error text, are what make a
report actionable.

## License

[MIT](LICENSE.md)
