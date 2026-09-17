# Contributing

Propose only an image already published on Alosem that you created or have explicit rights to share.

1. Add its public slug, campaign category, review date, verdict, and honest review notes to `data/sources.json`.
2. Confirm the public page exposes the exact submitted prompt, GPT Image 2.5 family label, dimensions, and stable 512/1024/original image URLs.
3. Run `node scripts/export.mjs`, `node --test scripts/*.test.mjs`, and `node scripts/validate.mjs --links`.
4. Review the generated case page and catalogue record before opening a pull request.

Do not submit private user records, secrets, third-party reference files, personal data, real-person identity material without documented consent, sexualized minors, non-consensual intimate imagery, deceptive impersonation, hateful content, or work with uncertain ownership. A public URL alone is not proof of rights.

Contributors agree that catalogue text and data they submit may be distributed under CC BY 4.0. Linked images are not copied into this repository and retain their existing rights. Report security or privacy issues privately through [this repository’s GitHub Security Advisories](../../security/advisories/new), not in a public issue.
