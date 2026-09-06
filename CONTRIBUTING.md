# Contributing

Propose only a case that is already public on Pixexid or Alosem and that you created or have explicit rights to share.

1. Add its `origin`, canonical `/i/` URL, public `/ai-composition/` URL, and accurate rights basis to `data/sources.json`. Alosem composition URLs must include the published `scene` query parameter.
2. Run `node scripts/export.mjs` and `node scripts/validate.mjs --links`.
3. Review the generated prompt, metadata, image, and complete public input graph before opening a pull request.

Alosem reference previews are bound to the publication epoch. Re-export after every composition revision, republication, or revoke; stale epoch URLs must fail validation rather than remain in the atlas.

Do not submit private user records, secrets, third-party reference files, personal data, real-person identity material without documented consent, sexualized minors, non-consensual intimate imagery, deceptive impersonation, hateful content, or work with uncertain ownership. A public URL alone is not proof of rights.

Contributors agree that catalog text and data they submit may be distributed under CC BY 4.0. Linked images are not copied into this repository and keep their existing rights. Security or privacy issues should be reported privately through [GitHub Security Advisories](https://github.com/pixexid/pixexid-prompt-atlas/security/advisories/new), not in a public issue.
