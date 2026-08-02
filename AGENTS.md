## Git workflow

Per PR (one PR per feature-spec scenario group, per `docs/adr/0013-build-plan.md`):

1. Create a new branch from `main`.
2. Commit the changes on that branch.
3. Push the branch.
4. Give the user a link to open the PR — do not open the PR yourself.
5. The user creates the PR and reviews it.

Never commit directly to `main`, and never open the PR itself — that step is
always the user's.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
