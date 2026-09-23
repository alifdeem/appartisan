Featured-trade photographs go here, named after the category slug — e.g.
`electrical.jpg`, `plumbing.jpg`.

The slugs are in `supabase/migrations/0004_reference_data.sql`; the ones the
home screen actually looks for are `FEATURED_SLUGS` in `src/lib/images.ts`.
Generation prompts: `designing-ui-ux/IMAGE-PROMPTS-HOME.md`.

A missing file is not an error — the card falls back to a tinted panel carrying
the trade's icon, at the same aspect ratio, so nothing on the page moves when
the photograph arrives.
