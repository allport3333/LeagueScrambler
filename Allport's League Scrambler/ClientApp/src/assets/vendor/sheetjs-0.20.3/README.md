# SheetJS Community Edition 0.20.3

Vendored from the authoritative distribution, with its Apache 2.0 LICENSE.

- Script: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
- SHA-256: `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`
- Documentation: https://docs.sheetjs.com/docs/getting-started/installation/standalone/
- Parsing: https://docs.sheetjs.com/docs/api/parse-options/
- Security: https://docs.sheetjs.com/docs/miscellany/security/

Downloaded November 20, 2026. Only the local import worker loads this script;
there is no runtime CDN request or Angular/TypeScript dependency upgrade.
The worker rejects unsafe archives, bounds actual ZIP expansion, applies sheet,
row, column, file and time limits, and does not execute formulas/macros or export
HTML. Review upstream releases/security information when updating this copy.
