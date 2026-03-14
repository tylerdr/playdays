# Changelog

## 1.0.0 (2026-03-14)


### Features

* auth foundation — magic-link, middleware, Supabase persistence migration ([da5bff3](https://github.com/tylerdr/playdays/commit/da5bff3177118d2ba4b192efc98c54ff18a1be14))
* build PlayDays MVP ([6cc522c](https://github.com/tylerdr/playdays/commit/6cc522c40703fc373283f0bbe974643bc3027efd))
* events feed, unified profile, schedule/activity prefs, custom sources ([14f17e6](https://github.com/tylerdr/playdays/commit/14f17e6f5697bb08369b6ca4a386e0b7577eea76))
* magic-link auth, middleware, Supabase persistence migration (conflicts resolved) ([9d537f5](https://github.com/tylerdr/playdays/commit/9d537f5655af0f13b290d172ef378caf4de5a2ec))
* Supabase-backed chat context, digest agents, event discovery, cron plumbing (conflict resolved) ([13de869](https://github.com/tylerdr/playdays/commit/13de869fa6b6c8d08fe44f9141e7be06f46ddeac))
* upgrade chat and add multi-provider AI fallback ([27d1f69](https://github.com/tylerdr/playdays/commit/27d1f69dca0465c631345b970406e5ea692de916))


### Bug Fixes

* add og:image meta ([f80f81e](https://github.com/tylerdr/playdays/commit/f80f81ed808c7fc7c74953b74fd3fdfae92c74f2))
* hydration mismatch on ProfileForm, rename middleware to proxy ([4ff77c4](https://github.com/tylerdr/playdays/commit/4ff77c42c0f5f0fe753e4f808361380c868cddd9))
* normalize Anthropic model selection ([5e7bf61](https://github.com/tylerdr/playdays/commit/5e7bf61a5c58ca5956a837658859af3f0acc683c))
* onboarding UX overhaul - interests input, rhythm layout, typeform flow, schema validation, footer, nav auth state ([c19f3e9](https://github.com/tylerdr/playdays/commit/c19f3e9de1790bdbd6abc9dac2e91023577a196d))
* remove uri format from AI generateObject schemas (gpt-4.1-mini compat) ([9caeb8e](https://github.com/tylerdr/playdays/commit/9caeb8e68cdde09473ee70a090407dd22f0ab136))
* replace optional() with nullable().default(null) for OpenAI structured output compat ([049741a](https://github.com/tylerdr/playdays/commit/049741aff544fcfa5a09bc6f419adc09d561ad4f))
* use generateObject mode=json for gpt-4.1-mini structured output compat ([9d3a02c](https://github.com/tylerdr/playdays/commit/9d3a02c3dc81d4f477d50531e0ce7a968e4b1dc9))
* weather geocoding, local discovery fallback, schedule blocks ([f2093a9](https://github.com/tylerdr/playdays/commit/f2093a9ab6d3ae4dd4a0dfb23299eb19ae56aea9))
