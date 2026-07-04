# sources

Pillcrow shelf manifests.

## Main Source

Add this search-only source link in Pillcrow:

```text
https://raw.githubusercontent.com/aethiop/sources/main/shelf.json
```

`repo.json` carries the same manifest for older shared links.

## Test a Source

Use the CLI to validate a shelf and try its app-side search recipe:

```sh
npm run test:source -- shelf.json 10.2307/3762753 --dry-run
npm run test:source -- shelf.json sample --response examples/example.com.response.json
```

You can also test the raw GitHub copy after changes are pushed:

```sh
npm run test:source -- https://raw.githubusercontent.com/aethiop/sources/main/shelf.json 10.2307/3762753 --dry-run
```

The CLI keeps the same gate as Pillcrow: search rows only count when they
normalize to `id`, `title`, and a direct `https` book file.

## Search

The repo is intentionally search-only. The checked-in source uses
`example.com` as the host placeholder and follows the `json.php` API shape:

```text
https://example.com/json.php?object=e&doi={query}&fields=title&addkeys=*&page={page}
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
    "url": "https://example.com/json.php?object=e&doi={query}&fields=title&addkeys=*&page={page}",
    "items": "/records",
    "fields": {
      "id": "example-{id}",
      "title": "/title",
      "author": "/authors/0/name",
      "file": "/files/0/epub"
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

When search returns a valid row, Pillcrow imports the selected book through the
same reader pipeline used for files picked on-device.
