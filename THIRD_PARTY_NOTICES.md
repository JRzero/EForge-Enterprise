# Third-Party Notices

## RuoYi-Vue

EForge Enterprise plans to derive portions of its backend implementation from:

- Project: RuoYi-Vue
- Repository: https://github.com/yangzongzhuan/RuoYi-Vue
- Version baseline: 3.9.2
- Branch baseline: springboot3
- Commit baseline: a51a838b71b446ea27256900efe7ed2faa2a02fd
- License: MIT
- Copyright: RuoYi contributors / upstream copyright notice

The upstream MIT copyright and permission notice must be retained in copies or substantial portions of derived software.

The complete upstream LICENSE must be copied into the repository when backend source is imported.

## RuoYi frontend icon assets

The original frontend icon asset bundle is also used under RuoYi's MIT license:
all 88 SVGs from v3.9.2 behavior reference commit
`0e2d75c23c0d7a1fa85f660f06a59a4dd1ba14c0`, located at
`web/public/ruoyi-icons/v3.9.2/`, with its original LICENSE alongside the files.
Normalization removes external DTD/unused font stylesheet declarations, adds
missing scalable viewports, and repairs the duplicate closing path tag in
`button.svg`. Original glyph paths are preserved. Source/output hashes and the
complete manifest are in `web/features/menus/icons.json`; see ADR-0014.

## EForge dependency

Frontend foundation:

- Project: EForge
- Repository: https://github.com/JRzero/EForge
- Architecture baseline commit: a7b644b724f4264c1ca015ce4c686ca94476d62f

EForge remains a separately versioned dependency and is not vendored into this repository by default.
