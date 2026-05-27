# Codex Response 8 · Vicwest G9 Asset Fix

**Date**: 2026-05-27  
**Pick**: **8.a · Replace the relative ref with an absolute Cloudinary URL**

## 1. Decision

Use 8.a, but do not reuse a guessed URL. Investigation shows the existing
Vicwest Cloudinary folder contains the six GMB photos only; no `_source-logo.png`
Cloudinary asset was found for `place_chijkrzfmm9p0worrpl40dpbb7c`.

Upload the existing local source logo, then replace the `master.md` reference with
the returned `secure_url`.

## 2. Concrete File Edit

Edit `clients/vicwest-roofing/v2/master.md`:

```diff
-![现有 logo](clients/vicwest-roofing/v2/handoff/design/brand/_source-logo.png)
+![现有 logo](<returned Cloudinary secure_url for uploaded _source-logo.png>)
```

Recommended public ID:
`profitslocal/main-site/clients/place_chijkrzfmm9p0worrpl40dpbb7c/brand/source-logo`

## 3. Rationale

Do not choose 8.b: the section is intentional existing-identity evidence, not
dead content.

Do not choose 8.c: the stated goal is a clean pre-commit path without another
hook bypass.

## 4. Verification

After the edit, run normal pre-commit or the G9 check that reported the relative
asset. Stop if any remaining failure is not this Vicwest asset.
