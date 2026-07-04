# sources

Search-only Pillcrow source manifests.

## Source URL

Use this source URL in Pillcrow:

```text
https://raw.githubusercontent.com/aethiop/sources/refs/heads/main/shelf.json
```

`repo.json` mirrors `shelf.json` for older shared links.

## Manifest Shape

Pillcrow sources are declarative JSON. They describe where the app can search
and how JSON results map into normal book rows. A source cannot run code on a
reader's phone.

```json
{
  "pillcrowShelf": 1,
  "name": "Search Source",
  "home": "catalog.example",
  "about": "A search-only Pillcrow source.",
  "books": [],
  "search": {
    "version": 1,
    "format": "json",
    "url": "https://catalog.example/api/books?search={query}&page={page}",
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

Rules:

- `pillcrowShelf` must be `1`.
- `name` must be present.
- `books` may be empty for search-only sources.
- `search.url` must be HTTPS and include `{query}`.
- `search.items` is a JSON Pointer to the result rows.
- `search.fields` maps each row into a Pillcrow book.
- Each searchable result must resolve to `id`, `title`, and a direct HTTPS
  `file` URL.
- Optional fields include `author`, `words`, `map`, and `updated`.

Pillcrow imports selected search results through the same reader pipeline used
for files picked on-device.
