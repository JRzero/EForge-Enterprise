# RuoYi backend import baseline

- Repository: https://github.com/yangzongzhuan/RuoYi-Vue
- Version: 3.9.2
- Branch reference: springboot3
- Imported commit: a51a838b71b446ea27256900efe7ed2faa2a02fd

This directory initially preserves upstream backend module names and semantics so a green Maven baseline can be established before controlled renaming/refactoring.

The Vue frontend is intentionally not imported.

## EForge module identity migration

After the green upstream baseline was established, Maven/module identities were renamed:

- ruoyi-admin → eforge-boot
- ruoyi-framework → eforge-framework
- ruoyi-system → eforge-system
- ruoyi-common → eforge-common
- ruoyi-generator → eforge-generator
- ruoyi-quartz → eforge-quartz

Maven groupId is now io.eforge.enterprise and the framework version starts at 0.1.0-SNAPSHOT.

Java package names intentionally remain io.eforge.enterprise at this stage and will be migrated separately.
