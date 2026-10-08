package io.eforge.enterprise.web.controller.api.v1.system;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.junit.jupiter.api.Assertions.*;

class UserImportFileReaderTest
{
    private final UserImportFileReader files = new UserImportFileReader();

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void acceptsTheThousandthPhysicalDataRowAndKeepsOriginalConverters(boolean xls) throws Exception
    {
        var rows = files.read(upload(xls, workbook(xls, 1000, false, false)));

        assertEquals(1, rows.size());
        var user = rows.get(0);
        assertEquals("member", user.getUserName());
        assertEquals(103L, user.getDeptId());
        assertEquals("2", user.getSex());
        assertEquals("1", user.getStatus());
        assertNull(user.getUserId());
        assertNull(user.getPassword());
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void rejectsSparseAndBlankRowsBeyondTheSameFirstSheetLimit(boolean xls) throws Exception
    {
        assertCode("USER_IMPORT_TOO_LARGE", upload(xls, workbook(xls, 1001, false, false)));
        try (Workbook workbook = xls ? new HSSFWorkbook() : new XSSFWorkbook())
        {
            var sheet = workbook.createSheet();
            sheet.createRow(0).createCell(0).setCellValue("登录名称");
            sheet.createRow(1).createCell(0).setCellValue("member");
            sheet.createRow(1001);
            assertCode("USER_IMPORT_TOO_LARGE", upload(xls, bytes(workbook)));
        }
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void onlyTheFirstTabIsImportedEvenWhenPhysicalSheetOrderDiffers(boolean xls) throws Exception
    {
        assertEquals("member", files.read(upload(xls, workbook(xls, 1, true, false))).get(0).getUserName());
        assertCode("USER_IMPORT_TOO_LARGE", upload(xls, workbook(xls, 1, true, true)));
    }

    @Test
    void rejectsTheFirstOverLimitXmlRowBeforeBuildingAnInvalidLaterRow() throws Exception
    {
        Map<String, byte[]> parts = parts(workbook(false, 1, false, false));
        parts.put("xl/worksheets/sheet1.xml", ("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
                + "<sheetData><row r=\"1002\"/><row r=\"2147483648\"/></sheetData></worksheet>").getBytes(StandardCharsets.UTF_8));

        // The XML is well formed, but the later row cannot be represented in an XSSF cell model.
        assertCode("USER_IMPORT_TOO_LARGE", upload(false, zip(parts)));
    }

    @Test
    void filenameAndRealContainerFormatMustAgree() throws Exception
    {
        byte[] xlsx = workbook(false, 1, false, false);
        byte[] xls = workbook(true, 1, false, false);
        assertCode("USER_IMPORT_FILE_INVALID", upload(true, xlsx));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, xls));
        assertCode("USER_IMPORT_FILE_INVALID", new MockMultipartFile("file", "users.csv", "application/vnd.ms-excel", xlsx));
        assertCode("USER_IMPORT_FILE_INVALID", new MockMultipartFile("file", "users.xlsx", "application/vnd.ms-excel", xls));
        assertCode("USER_IMPORT_FILE_INVALID", new MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[] {1, 2, 3}));
        assertCode("USER_IMPORT_FILE_INVALID", new MockMultipartFile("file", "users.xls", "application/octet-stream", new byte[] {(byte) 0xd0, (byte) 0xcf, 0x11, (byte) 0xe0, (byte) 0xa1, (byte) 0xb1, 0x1a, (byte) 0xe1}));
        assertEquals(1, files.read(new MockMultipartFile("file", "USERS.XLSX", "application/octet-stream", xlsx)).size());
    }

    @Test
    void arbitraryZipAndRenamedMacroWorkbookAreNotAcceptedAsXlsx() throws Exception
    {
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(Map.of("document.xml", "<root/>".getBytes(StandardCharsets.UTF_8)))));
        var parts = parts(workbook(false, 1, false, false));
        String types = new String(parts.get("[Content_Types].xml"), StandardCharsets.UTF_8)
                .replace("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
                        "application/vnd.ms-excel.sheet.macroEnabled.main+xml");
        parts.put("[Content_Types].xml", types.getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
    }

    @Test
    void realPoiCorePropertiesRemainReadableIncludingATypedNonstandardFilename() throws Exception
    {
        var parts = parts(workbook(false, 1, false, false));
        assertTrue(parts.containsKey("docProps/core.xml"));
        assertEquals(1, files.read(upload(false, zip(parts))).size());
        parts.put("docProps/core.data", parts.remove("docProps/core.xml"));
        for (String path : new String[] {"[Content_Types].xml", "_rels/.rels"})
            parts.put(path, new String(parts.get(path), StandardCharsets.UTF_8)
                    .replace("docProps/core.xml", "docProps/core.data").getBytes(StandardCharsets.UTF_8));
        assertEquals(1, files.read(upload(false, zip(parts))).size());

        String deep = "<n>".repeat(UserImportFileReader.MAX_XML_DEPTH + 1)
                + "</n>".repeat(UserImportFileReader.MAX_XML_DEPTH + 1);
        parts.put("docProps/core.data", deep.getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
    }

    @Test
    void missingEmptyAndUnreadableUploadsHaveSafeErrors() throws Exception
    {
        assertCode("USER_IMPORT_FILE_INVALID", null);
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, new byte[0]));
        var broken = new MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[] {1})
        {
            @Override public InputStream getInputStream() throws IOException { throw new IOException("private storage path"); }
        };
        var failure = assertThrows(ApiFailure.class, () -> files.read(broken));
        assertEquals("USER_IMPORT_FILE_INVALID", failure.code());
        assertFalse(failure.getMessage().contains("private"));
    }

    @Test
    void actualUploadBytesAreBoundedEvenWhenMetadataUnderreportsThem() throws Exception
    {
        AtomicInteger read = new AtomicInteger();
        AtomicBoolean closed = new AtomicBoolean();
        var file = new MockMultipartFile("file", "users.xlsx", "application/octet-stream", new byte[] {1})
        {
            @Override public InputStream getInputStream()
            {
                return new InputStream()
                {
                    @Override public int read() { read.incrementAndGet(); return 0; }
                    @Override public void close() { closed.set(true); }
                };
            }
        };

        assertCode("USER_IMPORT_FILE_INVALID", file);
        assertEquals(UserImportFileReader.MAX_BYTES + 1, read.get());
        assertTrue(closed.get());
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void uploadIsOpenedOnceAndClosedOnBothSuccessAndParseFailure(boolean broken) throws Exception
    {
        byte[] bytes = broken ? new byte[] {1, 2, 3} : workbook(false, 1, false, false);
        AtomicInteger opened = new AtomicInteger();
        AtomicBoolean closed = new AtomicBoolean();
        var file = new MockMultipartFile("file", "users.xlsx", "application/octet-stream", bytes)
        {
            @Override public InputStream getInputStream()
            {
                opened.incrementAndGet();
                return new ByteArrayInputStream(bytes)
                {
                    @Override public void close() throws IOException { closed.set(true); super.close(); }
                };
            }
        };
        if (broken) assertCode("USER_IMPORT_FILE_INVALID", file);
        else assertEquals(1, files.read(file).size());
        assertEquals(1, opened.get());
        assertTrue(closed.get());
    }

    @Test
    void zipEntryBudgetIncludesPartsUnrelatedToTheImportedSheet() throws Exception
    {
        var parts = parts(workbook(false, 1, false, false));
        while (parts.size() < UserImportFileReader.MAX_ZIP_ENTRIES)
            parts.put("customXml/unused" + parts.size() + ".xml", "<root/>".getBytes(StandardCharsets.UTF_8));
        assertEquals(1, files.read(upload(false, zip(parts))).size());
        parts.put("customXml/one-too-many.xml", "<root/>".getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
    }

    @Test
    void highlyCompressedPartsCannotExceedTheLocalExpansionBudget() throws Exception
    {
        var parts = parts(workbook(false, 1, false, false));
        parts.put("customXml/large.xml", new byte[(int) UserImportFileReader.MAX_EXPANDED_BYTES]);
        byte[] packed = zip(parts);
        assertTrue(packed.length < UserImportFileReader.MAX_BYTES);
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, packed));
    }

    @Test
    void xmlComplexityAndDtdGuardsApplyToUnrelatedPartsBeforeBuildingTheWorkbook() throws Exception
    {
        var parts = parts(workbook(false, 1, false, false));
        String nested = "<n>".repeat(40) + "</n>".repeat(40);
        parts.put("customXml/unused.xml", nested.getBytes(StandardCharsets.UTF_8));
        assertEquals(1, files.read(upload(false, zip(parts))).size());
        nested = "<n>".repeat(UserImportFileReader.MAX_XML_DEPTH + 1) + "</n>".repeat(UserImportFileReader.MAX_XML_DEPTH + 1);
        parts.put("customXml/unused.xml", nested.getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
        parts.put("customXml/unused.xml", "<!DOCTYPE n [<!ENTITY secret SYSTEM 'file:///unavailable-import-fixture'>]><n>&secret;</n>".getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
        StringBuilder many = new StringBuilder("<root>");
        for (int index = 0; index < UserImportFileReader.MAX_STRUCTURES; index++) many.append("<n v=\"").append(index).append("\"/>");
        parts.put("customXml/unused.xml", many.append("</root>").toString().getBytes(StandardCharsets.UTF_8));
        assertCode("USER_IMPORT_FILE_INVALID", upload(false, zip(parts)));
    }

    private void assertCode(String code, MockMultipartFile file)
    {
        ApiFailure failure = assertThrows(ApiFailure.class, () -> files.read(file));
        assertEquals(400, failure.status());
        assertEquals(code, failure.code());
    }

    private static MockMultipartFile upload(boolean xls, byte[] bytes)
    { return new MockMultipartFile("file", xls ? "users.xls" : "users.xlsx", "application/octet-stream", bytes); }

    private static byte[] workbook(boolean xls, int rowIndex, boolean secondSheet, boolean reorder) throws Exception
    {
        try (Workbook workbook = xls ? new HSSFWorkbook() : new XSSFWorkbook())
        {
            var sheet = workbook.createSheet("import");
            String[] headers = {"登录名称", "部门编号", "用户性别", "账号状态"};
            var header = sheet.createRow(0);
            for (int index = 0; index < headers.length; index++) header.createCell(index).setCellValue(headers[index]);
            var row = sheet.createRow(rowIndex);
            row.createCell(0).setCellValue("member");
            row.createCell(1).setCellValue(103);
            row.createCell(2).setCellValue("未知");
            row.createCell(3).setCellValue("停用");
            if (secondSheet)
            {
                var ignored = workbook.createSheet("other");
                ignored.createRow(0).createCell(0).setCellValue("登录名称");
                ignored.createRow(1001).createCell(0).setCellValue("not-imported");
                if (reorder) workbook.setSheetOrder("other", 0);
            }
            return bytes(workbook);
        }
    }

    private static byte[] bytes(Workbook workbook) throws Exception
    { var output = new ByteArrayOutputStream(); workbook.write(output); return output.toByteArray(); }

    private static Map<String, byte[]> parts(byte[] bytes) throws Exception
    {
        Map<String, byte[]> parts = new LinkedHashMap<>();
        try (var input = new ZipInputStream(new ByteArrayInputStream(bytes)))
        {
            for (var entry = input.getNextEntry(); entry != null; entry = input.getNextEntry())
                parts.put(entry.getName(), input.readAllBytes());
        }
        return parts;
    }

    private static byte[] zip(Map<String, byte[]> parts) throws Exception
    {
        var bytes = new ByteArrayOutputStream();
        try (var output = new ZipOutputStream(bytes))
        {
            for (var part : parts.entrySet())
            {
                output.putNextEntry(new ZipEntry(part.getKey()));
                output.write(part.getValue());
                output.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
}
