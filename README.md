# sources

Pillcrow shelf manifests.

## Main Shelf

Add this shelf link in Pillcrow:

```text
https://raw.githubusercontent.com/aethiop/sources/main/shelf.json
```

`repo.json` carries the same manifest for older shared links.

## Books

The main shelf is seeded with public-domain EPUBs delivered by direct HTTPS
links. Pillcrow imports them through the normal book pipeline.

- Narrative of the Life of Frederick Douglass, an American Slave
- Middlemarch
- Pride and Prejudice
- Moby-Dick; or, The Whale
- Frankenstein; Or, The Modern Prometheus
- Jane Eyre
- The Adventures of Sherlock Holmes
- The Souls of Black Folk

The shelf also declares app-side search. Pillcrow sends the query to the
configured HTTPS JSON endpoint, reads rows from the configured JSON pointer, and
keeps only results that resolve to a direct HTTPS EPUB.

## Shelf Format

Pillcrow shelves are declarative JSON. A shelf can list downloadable books and
optional `.bmap` companions, but it cannot run code on a reader's phone.

```json
{
  "pillcrowShelf": 1,
  "name": "Pillcrow Shelf",
  "home": "github.com/aethiop/sources",
  "about": "A short description shown before the shelf is added.",
  "books": [
    {
      "id": "middlemarch",
      "title": "Middlemarch",
      "author": "George Eliot",
      "words": 316000,
      "file": "https://example.org/books/middlemarch.epub",
      "map": "https://example.org/maps/middlemarch.bmap",
      "updated": "2026-05-01"
    }
  ],
  "search": {
    "version": 1,
    "format": "json",
    "url": "https://example.org/books?search={query}&page={page}",
    "items": "/results",
    "fields": {
      "id": "catalog-{id}",
      "title": "/title",
      "author": "/authors/0/name",
      "file": "/formats/application~1epub+zip"
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

Pillcrow imports every listed book through the same reader pipeline used for
files picked on-device.
