package io.eforge.enterprise.web.controller.api.v1.system;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockHttpServletResponse;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import io.eforge.enterprise.common.core.domain.entity.SysUser;
import io.eforge.enterprise.common.core.domain.entity.SysRole;
import io.eforge.enterprise.common.utils.poi.CanonicalExcelUtil;
import static org.junit.jupiter.api.Assertions.*;
class CanonicalExcelIdentityTest {
    static class WideInteger {
        @io.eforge.enterprise.common.annotation.Excel(name="identity",cellType=io.eforge.enterprise.common.annotation.Excel.ColumnType.NUMERIC)
        public java.math.BigInteger identity;
    }
    @ParameterizedTest @CsvSource({"0,NUMERIC","999999999999999,NUMERIC","1000000000000000,STRING","-9223372036854775809,STRING"})
    void bigIntegerWorkbookRetainsExactValuesBeyondLongBounds(String value,CellType type) throws Exception {
        var record=new WideInteger();record.identity=new java.math.BigInteger(value);
        var response=new MockHttpServletResponse();new CanonicalExcelUtil<>(WideInteger.class).exportExcel(response,List.of(record),"wide");
        try(var workbook=WorkbookFactory.create(new java.io.ByteArrayInputStream(response.getContentAsByteArray()))){
            var cell=workbook.getSheetAt(0).getRow(1).getCell(0);assertEquals(type,cell.getCellType());
            if(type==CellType.STRING)assertEquals(value,cell.getStringCellValue());else assertEquals(record.identity.doubleValue(),cell.getNumericCellValue());
        }
    }
    @ParameterizedTest @CsvSource({"1,NUMERIC","2147483648,NUMERIC","999999999999999,NUMERIC","1000000000000000,STRING","9007199254740993,STRING","9223372036854775807,STRING","-2147483649,NUMERIC","-9223372036854775808,STRING"})
    void workbookRetainsExactUserIdentityAcrossIntegerAndExcelPrecisionBoundaries(long id,CellType expectedType) throws Exception {
        var user=new SysUser(id);user.setUserName("identity-fixture");user.setNickName("=safe literal");
        var response=new MockHttpServletResponse();new CanonicalExcelUtil<>(SysUser.class).exportExcel(response,List.of(user),"identity");
        try(var workbook=WorkbookFactory.create(new java.io.ByteArrayInputStream(response.getContentAsByteArray()))){
            var row=workbook.getSheetAt(0).getRow(1);var cell=row.getCell(0);assertEquals(expectedType,cell.getCellType());
            if(expectedType==CellType.STRING)assertEquals(Long.toString(id),cell.getStringCellValue());else assertEquals((double)id,cell.getNumericCellValue());
            var headers=workbook.getSheetAt(0).getRow(0);for(int i=0;i<headers.getLastCellNum();i++)if("用户名称".equals(headers.getCell(i).getStringCellValue())){assertEquals(CellType.STRING,row.getCell(i).getCellType());assertEquals("\t=safe literal",row.getCell(i).getStringCellValue());}
        }
    }
    @Test void roleWorkbookUsesTheSameIdentityBoundaryAndPreservesOtherNumericAndConverterColumns() throws Exception {
        var role=new SysRole(9007199254740993L);role.setRoleName("角色");role.setRoleKey("literal");role.setRoleSort(12);role.setStatus("0");role.setDataScope("1");
        var response=new MockHttpServletResponse();new CanonicalExcelUtil<>(SysRole.class).exportExcel(response,List.of(role),"roles");
        try(var workbook=WorkbookFactory.create(new java.io.ByteArrayInputStream(response.getContentAsByteArray()))){var row=workbook.getSheetAt(0).getRow(1);assertEquals("9007199254740993",row.getCell(0).getStringCellValue());assertEquals("12",new org.apache.poi.ss.usermodel.DataFormatter().formatCellValue(row.getCell(3)));assertEquals("所有数据权限",row.getCell(4).getStringCellValue());assertEquals("正常",row.getCell(5).getStringCellValue());}
    }
}
