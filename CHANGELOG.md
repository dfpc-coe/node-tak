# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v11.20.2 - 2025-12-24

- :bug: Update Github Actions Workflow

### v11.20.1 - 2025-12-21

- :bug: Update Github Actions Workflow

### v11.20.0 - 2025-12-21

- :tada: Introduce deleting/revoking by ID and add TS Docs

### v11.19.0 - 2025-12-21

- :tada: Introduce first batch of Certificate APIs

### v11.18.2 - 2025-12-16

- :rocket: Add Build Step

### v11.18.1 - 2025-12-15

- :rocket: Update Release Process

### v11.18.0 - 2025-12-04

- :rocket: Update Mission type to require description

### v11.17.4 - 2025-12-03

- :bug: Update Mission must occur via `guid`

### v11.17.3 - 2025-12-02

- :bug: Fix Mission Creation with Groups

### v11.17.2 - 2025-12-02

- :rocket: Use `PUT` For Mission Creation

### v11.17.1 - 2025-12-02

- :rocket: Fix Group Assignments in Mission Updates

### v11.17.0 - 2025-12-02

- :tada: Allow setting keywords when creating or updating Missions

### v11.16.0 - 2025-12-02

- :tada: Mission Updates

### v11.15.0 - 2025-11-30

- :tada: Introduce Listing Mission Invites

### v11.14.0 - 2025-11-19

- :rocket: Allow filtering Data Packages by name

### v11.13.0 - 2025-11-10

- :rocket: Add Iconset API Wrapper

### v11.12.0 - 2025-10-29

- :bug: Due to a bug in TAK Server (https://issues.tak.gov/browse/TKS-1023) patch the Mission List Layers to only use Mission Name

### v11.11.0 - 2025-10-29

- :rocket: Add interactive subcommand selection

### v11.10.1 - 2025-10-24

- :rocket: Additional `dtg` Log support

### v11.10.0 - 2025-10-24

- :rocket: Allow setting Log `dtg` values

### v11.9.8 - 2025-10-09

- :bug: Throw invalid password for 401 or 403 code on OAuth Generation

### v11.9.7 - 2025-10-09

- :bug: Make `Package.MIMEType` optional

### v11.9.6 - 2025-10-09

- :bug: Make `Mission.Content[].SubmissionUser` optional
- :bug: Make `Mission.Content[].MimeType` optional

### v11.9.5 - 2025-10-09

- :bug: Make `Package.SubmissionUser` optional

### v11.9.4 - 2025-10-09

- :bug: Make `Package.Keywords` optional

### v11.9.3 - 2025-10-09

- :bug: Make `Package.Tool` optional

### v11.9.2 - 2025-10-07

- :bug: Pass LogID value in Mission Log Update

### v11.9.1 - 2025-09-29

- :rocket: Don't allow forward slashes in Mission Names

### v11.9.0 - 2025-09-29

- :rocket: Mission Creation is now done by a single query param

### v11.8.0 - 2025-09-11

- :rocket: Include Int Certs in returned CA chain

### v11.7.0 - 2025-09-11

- :tada: Add `Security` Module

### v11.6.0 - 2025-09-07

- :tada: Allow setting Groups when creating a Mission Package
- :rocket: Add the ability to set keywords on a Mission Package

### v11.5.0 - 2025-09-07

- :rocket: Migrate to `xml-js` and remove `xml2js` to reduce dependency count

### v11.4.0 - 2025-09-07

- :tada: Allow constructor opts to pass through CoT Parser options

### v11.3.1

- :bug: Remove Debug Calls
- :arrow_up: Update Core Deps

### v11.3.0

- :tada: Add support for Group Selection in Video Creation API (v2)

### v11.2.2

- :bug: Make CreatorUID Optional

### v11.2.1

- :bug: Make CreatorUID Optional

### v11.2.0

- :rocket: Explicitly export Type Definitions in package.json
- :rocket: Include declaration files in build process

### v11.1.1

- :rocket: Handle different content-types in Package List API

### v11.1.0

- :rocket: TAK Server 5.5 changed the Cookie format so this PR switches to Bearer tokens

### v11.0.1

- :arrow_up: Update Core Deps

### v11.0.0

- :rocket: Update `TAK.write` function to use promises
- :rocket: Update all instances of CoTParser to await new Promise

### v10.2.0

- :arrow_up: Update Mission Response expectations

### v10.1.0

- :arrow_up: Include CA list in SignClient list

### v10.0.0

- :arrow_up: Migrate to `node-cot@13`

### v9.3.2

- :arrow_up: Update Core Deps

### v9.3.1

- :arrow_up: Update Core Deps

### v9.3.0

- :tada: Add Profile Connection API Call

### v9.2.2

- :arrow_up: Update Core Deps

### v9.2.1

- :bug: Ensure MissionTokens are used internally if present in a top level call

### v9.2.0

- :rocket: Ensure Mission Name meets regex/length requirements of TAK Server on creation
- :tada: Add Locate API SDK

### v9.1.0

- :rocket: Register and validate `--format` flag in CLI
- :tada: Allow specifying custom p12 file for auth

### v9.0.1

- :bug: Fix Global bin registration

### v9.0.0

- :rocket: *Breaking* Change TAK constructor & connect sig. to make CloudTAK used props optional
- :tada: Introduce new CLI
- :tada: Introduce `Files.list` API Integration

### v8.10.0

- :rocket: Support additional TLS options

### v8.9.0

- :rocket: Allow getting & setting repeater period

### v8.8.1

- :bug: Fix relative path

### v8.8.0

- :rocket: Add exports field to package.json

### v8.7.0

- :tada: Add ability to delete Repeater

### v8.6.0

- :tada: Add initial support for the Repeaters API

### v8.5.0

- :tada: Add initial support for the Injectors API

### v8.4.1

- :bug: Fix named export

### v8.4.0

- :tada: Include TAK API Operations SDK

### v8.3.0

- :rocket: Events are always forwarded regardless of destroyed status
- :arrow_up: Update all core deps

### v8.2.1

- :rocket: Explicit TS return defs

### v8.2.0

- :arrow_up: Update all core deps

### v8.1.0

- :arrow_up: Update all core deps

### v8.0.0

- :arrow_up: Update required `node-cot` version to 12

### v7.0.0

- :arrow_up: Update required `node-cot` version to 11

### v6.0.0

- :arrow_up: Update required `node-cot` version to 10

### v5.0.0

- :arrow_up: Update required `node-cot` version to 9

### v4.4.0

- :rocket: Remove Remainder

### v4.3.1

- :bug: Optimize Regex Compilation

### v4.3.0

- :bug: Optimize Regex Compilation

### v4.2.0

- :bug: Fix remainder values for multi-line regex

### v4.1.1

- :bug: Fix lints

### v4.1.0

- :rocket: Support parsing XML CoTs with multiline fields

### v4.0.2

- :arrow_up: Add necessary library types

### v4.0.1

- :arrow_up: Update required `node-tak` version to 8.0.1

### v4.0.0

- :arrow_up: Update required `node-tak` version to 8

### v3.0.0

- :arrow_up: Update required `node-tak` version to 7

### v2.1.2

- :rocket: Add automatic GH Release

### v2.1.1

- :arrow_up: Move ts-eslint to dev deps

### v2.1.0

- :arrow_up: Update to ESLint Flat Config System

### v2.0.1

- :white_check_mark: Fix tests

### v2.0.0

- :arrow_up: Update `node-cot@6.1` Which uses the new `.properties.metadata` for user defined properties

### v1.9.0

- :arrow_up: Increase Ping Aggressiveness

### v1.8.0

- :arrow_up: Update to latest TS Libraries and Node-COT@5.5

### v1.7.0

- :bug: Fix leak where retries would spin up new Ping Intervals

### v1.6.1

- :bug: Fix capture group to not be numbered

### v1.6.0

- :bug: Update regex in findCoT to find `<event>` but not `<events>`
- :arrow_up: Update to latest deps

### v1.5.0

- :arrow_up: Update to latest deps
- :rocket: Add `secureConnect` event

### v1.4.0

- :bug: Destory client when a new client is created after `reconnect` is called

### v1.3.0

- :rocket: Perform initial parsing in try/catch
- :rocket: Remove ts-ignores now that node-cot has strong type defs

### v1.2.0

- :arrow_up: Move `node-cot` to `peerDependencies`

### v1.0.2

- :arrow_up: Update node-cot

### v1.0.1

- :arrow_up: Update node-cot

### v1.0.0

- :arrow_up: Update node-cot

### v0.4.2

- :arrow_up: Update node-cot

### v0.4.1

- :arrow_up: Update node-cot

### v0.4.0

- :rocket: Update node-cot to support encoding Polygons and LineStrings

### v0.3.3

- :bug: Non-Zero Opacity Level

### v0.3.2

- :bug: Close Polygons in Node-CoT

### v0.3.1

- :bug: Bump Build

### v0.3.0

- :bug: Properly encode Polygons in Node-COT

### v0.2.0

- :bug: Fix Lint Errors

### v0.1.0

- :pencil2: Add a CHANGELOG, Initial Commit
