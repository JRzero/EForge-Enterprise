package io.eforge.enterprise.web.controller.api.v1.system;

import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipInputStream;
import org.apache.poi.hssf.eventusermodel.HSSFEventFactory;
import org.apache.poi.hssf.eventusermodel.HSSFListener;
import org.apache.poi.hssf.eventusermodel.HSSFRequest;
import org.apache.poi.hssf.record.BOFRecord;
import org.apache.poi.hssf.record.BoundSheetRecord;
import org.apache.poi.hssf.record.CellValueRecordInterface;
import org.apache.poi.hssf.record.EOFRecord;
import org.apache.poi.hssf.record.MulBlankRecord;
import org.apache.poi.hssf.record.MulRKRecord;
import org.apache.poi.hssf.record.RowRecord;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.openxml4j.opc.PackagingURIHelper;
import org.apache.poi.openxml4j.opc.internal.ZipContentTypeManager;
import org.apache.poi.openxml4j.opc.internal.ZipHelper;
import org.apache.poi.poifs.filesystem.FileMagic;
import org.apache.poi.poifs.filesystem.POIFSFileSystem;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.util.XMLHelper;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.usermodel.XSSFRelation;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.Attributes;
import org.xml.sax.InputSource;
import org.xml.sax.helpers.DefaultHandler;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.poi.ExcelUtil;

/** Local file boundary shared by both user-import HTTP contracts. */
@Service
public class UserImportFileReader
{
    static final int MAX_BYTES = 10 * 1024 * 1024;
    static final int MAX_ROWS = 1000;
    static final int MAX_ZIP_ENTRIES = 256;
    static final long MAX_EXPANDED_BYTES = 32L * 1024 * 1024;
    static final int MAX_STRUCTURES = 200_000;
    static final int MAX_XML_DEPTH = 64;

    public List<SysUser> read(MultipartFile file)
    {
        String name = file == null || file.getOriginalFilename() == null ? ""
                : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        boolean xlsx = name.endsWith(".xlsx");
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES
                || !(xlsx || name.endsWith(".xls"))) throw invalidFile();
        try
        {
            byte[] bytes;
            // Bound actual bytes as well as the multipart metadata; never reopen the upload.
            try (InputStream input = file.getInputStream()) { bytes = input.readNBytes(MAX_BYTES + 1); }
            if (bytes.length == 0 || bytes.length > MAX_BYTES) throw invalidFile();
            FileMagic magic = FileMagic.valueOf(bytes);
            if (xlsx && magic == FileMagic.OOXML) return readXlsx(bytes);
            if (!xlsx && magic == FileMagic.OLE2) return readXls(bytes);
            throw invalidFile();
        }
        catch (ApiFailure failure) { throw failure; }
        catch (Exception failure) { throw invalidFile(); }
    }

    private List<SysUser> readXlsx(byte[] bytes) throws Exception
    {
        checkZipBudget(bytes);
        checkZipXml(bytes);
        try (OPCPackage parts = OPCPackage.open(new ByteArrayInputStream(bytes)))
        {
            if (parts.getPartsByContentType(XSSFRelation.WORKBOOK.getContentType()).size() != 1)
                throw invalidFile();
            var sheets = new XSSFReader(parts).getSheetsData();
            if (!sheets.hasNext()) throw invalidFile();
            // SAX rejects the first out-of-range row before XSSFWorkbook builds a cell model.
            try (InputStream sheet = sheets.next()) { parseXml(sheet, new FirstSheetRows()); }
            try (Workbook workbook = new XSSFWorkbook(parts)) { return convert(workbook); }
        }
    }

    private static void checkZipXml(byte[] bytes) throws Exception
    {
        XmlBudget budget = new XmlBudget();
        byte[] contentTypes = null;
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(bytes)))
        {
            for (var entry = input.getNextEntry(); entry != null; entry = input.getNextEntry())
            {
                String name = entry.getName().toLowerCase(Locale.ROOT);
                if ("[Content_Types].xml".equals(entry.getName()))
                {
                    // The preceding expansion pass bounds this allocation. SAX runs before POI's
                    // content-type manager builds its metadata model.
                    contentTypes = input.readAllBytes();
                    parseXml(new ByteArrayInputStream(contentTypes), budget);
                }
                else if (!entry.isDirectory() && xmlFilename(name)) parseXml(zipPart(input), budget);
            }
        }
        if (contentTypes == null) throw invalidFile();
        var types = new ZipContentTypeManager(new ByteArrayInputStream(contentTypes), null);
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(bytes)))
        {
            for (var entry = input.getNextEntry(); entry != null; entry = input.getNextEntry())
            {
                if (entry.isDirectory() || xmlFilename(entry.getName().toLowerCase(Locale.ROOT))) continue;
                var name = PackagingURIHelper.createPartName(ZipHelper.getOPCNameFromZipItemName(entry.getName()));
                String type = types.getContentType(name);
                if (type == null) throw invalidFile();
                String mime = type.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
                // Core properties can have nonstandard filenames and POI does not expose their
                // raw PackagePart input stream. Budget their original ZIP bytes before OPC opens.
                if (mime.endsWith("+xml") || mime.endsWith("/xml")) parseXml(zipPart(input), budget);
            }
        }
    }

    private static boolean xmlFilename(String name) { return name.endsWith(".xml") || name.endsWith(".rels"); }

    private static InputStream zipPart(ZipInputStream input)
    {
        // A SAX parser may close its source; ownership of the ZIP stays with the caller.
        return new FilterInputStream(input) { @Override public void close() {} };
    }

    private List<SysUser> readXls(byte[] bytes) throws Exception
    {
        try (POIFSFileSystem fileSystem = new POIFSFileSystem(new ByteArrayInputStream(bytes)))
        {
            HSSFRequest request = new HSSFRequest();
            request.addListenerForAllRecords(new FirstBiffSheetRows());
            new HSSFEventFactory().processWorkbookEvents(request, fileSystem);
            try (Workbook workbook = new HSSFWorkbook(fileSystem)) { return convert(workbook); }
        }
    }

    private List<SysUser> convert(Workbook workbook) throws Exception
    {
        if (workbook.getNumberOfSheets() == 0) throw invalidFile();
        var sheet = workbook.getSheetAt(0);
        checkRow(sheet.getLastRowNum());
        if (sheet.getRow(0) == null) throw invalidFile();
        boolean hasUsername = false;
        DataFormatter formatter = new DataFormatter();
        for (var cell : sheet.getRow(0))
            if ("登录名称".equals(formatter.formatCellValue(cell))) hasUsername = true;
        if (!hasUsername) throw invalidFile();
        List<SysUser> rows = new ExcelUtil<>(SysUser.class).importExcel("", workbook, 0);
        if (rows.isEmpty()) throw new ApiFailure(400, "USER_IMPORT_EMPTY", "The workbook has no data rows.");
        return rows;
    }

    private static void checkZipBudget(byte[] bytes) throws Exception
    {
        Set<String> names = new HashSet<>();
        long expanded = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(bytes)))
        {
            for (var entry = input.getNextEntry(); entry != null; entry = input.getNextEntry())
            {
                if (!names.add(entry.getName()) || names.size() > MAX_ZIP_ENTRIES) throw invalidFile();
                int count;
                while ((count = input.read(buffer)) != -1)
                    if ((expanded += count) > MAX_EXPANDED_BYTES) throw invalidFile();
            }
        }
    }

    private static void parseXml(InputStream input, DefaultHandler handler) throws Exception
    {
        var reader = XMLHelper.newXMLReader();
        reader.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        reader.setFeature("http://xml.org/sax/features/external-general-entities", false);
        reader.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        reader.setContentHandler(handler);
        reader.setErrorHandler(handler);
        reader.parse(new InputSource(input));
    }

    private static class XmlBudget extends DefaultHandler
    {
        private int elements;
        private int depth;
        @Override public void startElement(String uri, String local, String name, Attributes attributes)
        {
            if (++elements > MAX_STRUCTURES || ++depth > MAX_XML_DEPTH) throw invalidFile();
        }
        @Override public void endElement(String uri, String local, String name) { depth--; }
    }

    private static final class FirstSheetRows extends XmlBudget
    {
        private int row;
        @Override public void startElement(String uri, String local, String name, Attributes attributes)
        {
            super.startElement(uri, local, name, attributes);
            if (!XSSFRelation.NS_SPREADSHEETML.equals(uri)
                    && !"http://purl.oclc.org/ooxml/spreadsheetml/main".equals(uri)) return;
            if ("row".equals(local))
            {
                String value = attributes.getValue("r");
                int next = value == null ? row + 1 : Integer.parseInt(value);
                if (next <= row) throw invalidFile();
                row = next;
                checkRow(row - 1);
            }
            else if ("c".equals(local) && attributes.getValue("r") != null)
                checkRow(new CellReference(attributes.getValue("r")).getRow());
        }
    }

    private static final class FirstBiffSheetRows implements HSSFListener
    {
        private final List<BoundSheetRecord> tabs = new ArrayList<>();
        private int records;
        private int depth;
        private int sheetIndex = -1;
        private boolean importedSheet;
        @Override public void processRecord(org.apache.poi.hssf.record.Record record)
        {
            if (++records > MAX_STRUCTURES) throw invalidFile();
            if (record instanceof BoundSheetRecord tab) tabs.add(tab);
            else if (record instanceof BOFRecord start)
            {
                if (depth == 0 && start.getType() != BOFRecord.TYPE_WORKBOOK)
                {
                    var physical = BoundSheetRecord.orderByBofPosition(tabs);
                    importedSheet = ++sheetIndex < physical.length && physical[sheetIndex] == tabs.get(0);
                }
                depth++;
            }
            else if (record instanceof EOFRecord) depth--;
            else if (importedSheet && depth == 1)
            {
                if (record instanceof RowRecord row) checkRow(row.getRowNumber());
                else if (record instanceof CellValueRecordInterface cell) checkRow(cell.getRow());
                else if (record instanceof MulBlankRecord cells) checkRow(cells.getRow());
                else if (record instanceof MulRKRecord cells) checkRow(cells.getRow());
            }
        }
    }

    private static void checkRow(int row)
    {
        if (row < 0) throw invalidFile();
        if (row > MAX_ROWS)
            throw new ApiFailure(400, "USER_IMPORT_TOO_LARGE", "A workbook can contain at most 1000 data rows.");
    }

    private static ApiFailure invalidFile()
    { return new ApiFailure(400, "USER_IMPORT_FILE_INVALID", "Upload a valid XLS or XLSX user workbook."); }
}
