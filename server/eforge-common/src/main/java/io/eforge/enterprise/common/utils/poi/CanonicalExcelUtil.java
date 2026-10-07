package io.eforge.enterprise.common.utils.poi;

import java.math.BigInteger;
import org.apache.poi.ss.usermodel.Cell;
import io.eforge.enterprise.common.annotation.Excel;
import io.eforge.enterprise.common.annotation.Excel.ColumnType;

/** Canonical export boundary; retains the attributed RuoYi exporter for other cell behavior. */
public class CanonicalExcelUtil<T> extends ExcelUtil<T> {
    private static final BigInteger EXACT_EXCEL_INTEGER = new BigInteger("999999999999999");
    public CanonicalExcelUtil(Class<T> type) { super(type); }
    @Override public void setCellVo(Object value, Excel annotation, Cell cell) {
        if (annotation.cellType() == ColumnType.NUMERIC &&
                (value instanceof Long || value instanceof BigInteger)) {
            var integer = new BigInteger(value.toString());
            // Excel numeric cells retain 15 significant decimal digits. Larger identities are literal text.
            if (integer.abs().compareTo(EXACT_EXCEL_INTEGER) > 0) cell.setCellValue(integer.toString());
            else cell.setCellValue(integer.doubleValue());
            return;
        }
        super.setCellVo(value, annotation, cell);
    }
}
