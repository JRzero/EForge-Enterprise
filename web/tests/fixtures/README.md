# User import fixture

`users.xls` is a real BIFF8/OLE2 workbook generated with Apache POI HSSFWorkbook,
with UTF-8 source compilation. It contains the original seven import columns:
department, login name, display name, email, phone, sex and account status.
The single synthetic account is `legacy_xls_fixture` in department 103, with
display name `旧版Excel用户`, sex `未知`, status `正常` and empty contacts.
There are no credentials, production records or role/post assignment columns.
The real browser test imports it into the owned disposable database, authenticates
with that database's configured initial password and deletes the account.

Dynamic XLSX fixtures use the test helper's real OpenXML workbook writer and
exercise the same server parser. Neither fixture replaces actual persistence,
authentication, permission or workbook-content assertions.

`avatar.png` is a generated 4×2 RGB PNG with distinct quadrants, containing no
personal image or metadata. Runtime tests inspect normalization, serving,
database/Redis persistence and removal of the previous owned avatar file.
