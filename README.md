# sources

Pillcrow shelf manifests.

## Main Source

Add this search-only source link in Pillcrow:

```text
https://raw.githubusercontent.com/aethiop/sources/refs/heads/main/shelf.json
```

`repo.json` carries the same manifest for older shared links.

## Test a Source

Use the CLI to validate a shelf and try its app-side search recipe:

```sh
npm run test:source -- shelf.json "moby dick" --dry-run
npm run test:source -- shelf.json "moby dick" --response examples/example.com.response.json
npm run test:source -- shelf.json "moby dick" --response examples/metadata-only.response.json --inspect
```

You can also test the raw GitHub copy after changes are pushed:

```sh
npm run test:source -- https://raw.githubusercontent.com/aethiop/sources/refs/heads/main/shelf.json "moby dick" --dry-run
```

The CLI keeps the same gate as Pillcrow: search rows only count when they
normalize to `id`, `title`, and a direct `https` book file.

If a response says `Search returned no valid Pillcrow book rows`, run the same
command with `--inspect`. The diagnostics will show whether `items` points to
the wrong array or whether `fields.file` is resolving to metadata instead of a
direct importable URL.

## Search

The repo is intentionally search-only. The checked-in source uses
`example.com` as the host placeholder and follows a title-search normalizer
shape:

```text
https://example.com/api/books?search={query}&page={page}
```

Pillcrow sends the query to the configured HTTPS JSON endpoint, reads rows from
the configured JSON pointer, and keeps only results that resolve to a direct
HTTPS EPUB.

## Shelf Format

Pillcrow shelves are declarative JSON. A shelf can list downloadable books and
optional `.bmap` companions, but it cannot run code on a reader's phone.

```json
{
  "pillcrowShelf": 1,
  "name": "Pillcrow Shelf",
  "home": "github.com/aethiop/sources",
  "about": "A short description shown before the shelf is added.",
  "books": [],
  "search": {
    "version": 1,
    "format": "json",
    "url": "https://example.com/api/books?search={query}&page={page}",
    "items": "/results",
    "fields": {
      "id": "/id",
      "title": "/title",
      "author": "/author",
      "file": "/file",
      "words": "/words"
    }
  }
}
```

Rules from the Pillcrow app contract:

- `pillcrowShelf` must be exactly `1`.
- `name` must be present and non-empty.
- `books` may be empty.
- Every book needs `id`, `title`, and an `https` `file` URL.
- `author`, `words`, `map`, and `updated` are optional.
- `map`, when present, must also be an `https` URL.
- `search`, when present, is declarative JSON search: `url` is an HTTPS
  template, `items` is a JSON pointer to the result rows, and `fields` maps each
  row into a normal book entry.
- Metadata-only rows are not importable. If an API returns file IDs, hashes, or
  repository names instead of a direct HTTPS book URL, put a lawful normalizing
  endpoint in front of it and point `fields.file` at that endpoint's URL field.

When search returns a valid row, Pillcrow imports the selected book through the
same reader pipeline used for files picked on-device.
