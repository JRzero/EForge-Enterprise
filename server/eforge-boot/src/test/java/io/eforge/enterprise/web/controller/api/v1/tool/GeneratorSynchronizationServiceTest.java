package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.junit.jupiter.api.*;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.service.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorSynchronizationServiceTest {
    final GeneratorMetadataBoundary boundary=mock(GeneratorMetadataBoundary.class);
    final GenTableMapper tables=mock(GenTableMapper.class);
    final GenTableColumnMapper columns=mock(GenTableColumnMapper.class);
    final GeneratorSynchronizationService service=new GeneratorSynchronizationService(boundary,tables,columns);
    GenTable table;
    GenTableColumn field(String name,String type){var field=new GenTableColumn();field.setColumnName(name);field.setColumnType(type);field.setIsPk("0");field.setIsIncrement("0");field.setIsRequired("0");field.setSort(1);return field;}
    @BeforeEach void prepare(){table=new GenTable();table.setTableId(9007199254740993L);table.setTableName("owned_table");table.setTplCategory("crud");when(tables.selectGenTableById(table.getTableId())).thenReturn(table);when(tables.selectGenTableAll()).thenReturn(List.of());}
    @Test void exactIdAndPhysicalKeysChangeWhileOriginalConditionalChoicesRemain(){
        var old=field("name","varchar(64)");old.setColumnId(19L);old.setDictType("original_dict");old.setQueryType("LIKE");old.setIsRequired("1");old.setHtmlType("textarea");
        var actual=field("name","varchar(128)");actual.setIsIncrement("1");
        when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(actual));when(columns.selectGenTableColumnListByTableId(table.getTableId())).thenReturn(List.of(old));
        when(columns.updateGenTableColumn(any())).thenReturn(1);when(columns.updatePhysicalIdentity(any())).thenReturn(1);
        service.byId("9007199254740993","editor");assertEquals(19L,actual.getColumnId());assertEquals("varchar(128)",actual.getColumnType());assertEquals("1",actual.getIsIncrement());assertEquals("original_dict",actual.getDictType());assertEquals("LIKE",actual.getQueryType());assertEquals("1",actual.getIsRequired());assertEquals("textarea",actual.getHtmlType());assertEquals("editor",actual.getUpdateBy());
        var order=inOrder(boundary,tables,columns);order.verify(boundary).lock();order.verify(tables).selectGenTableById(table.getTableId());verify(columns).updatePhysicalIdentity(actual);
    }
    @Test void promotedPrimaryKeyResetsPreviousEditableQueryListFlags(){var old=field("name","varchar(64)");old.setColumnId(1L);old.setIsEdit("1");old.setIsList("1");old.setIsQuery("1");var actual=field("name","bigint");actual.setIsPk("1");actual.setIsIncrement("1");when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(actual));when(columns.selectGenTableColumnListByTableId(table.getTableId())).thenReturn(List.of(old));when(columns.updateGenTableColumn(any())).thenReturn(1);when(columns.updatePhysicalIdentity(any())).thenReturn(1);service.byId("9007199254740993","editor");assertEquals("0",actual.getIsEdit());assertEquals("0",actual.getIsList());assertEquals("0",actual.getIsQuery());assertEquals("1",actual.getIsPk());assertEquals("1",actual.getIsIncrement());}
    @Test void missingTableAndSchemaFailBeforeWrites(){assertThrows(ApiFailure.class,()->service.byId("1","editor"));when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of());var failure=assertThrows(ApiFailure.class,()->service.byId("9007199254740993","editor"));assertEquals("GENERATOR_SCHEMA_UNAVAILABLE",failure.code());verify(columns,never()).updateGenTableColumn(any());}
    @Test void invalidIdDoesNotAcquireLock(){assertThrows(ApiFailure.class,()->service.byId("9223372036854775808","editor"));verifyNoInteractions(boundary,tables,columns);}
    @Test void removingChildReferenceFieldIsRejectedBeforeWrites(){var parent=new GenTable();parent.setSubTableName("owned_table");parent.setSubTableFkName("removed_fk");when(tables.selectGenTableAll()).thenReturn(List.of(parent));when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(field("name","varchar(64)")));assertThrows(ApiFailure.class,()->service.byId("9007199254740993","editor"));verify(columns,never()).selectGenTableColumnListByTableId(any());}
    @Test void removingTreeFieldOrMalformedOptionsIsRejectedBeforeWrites(){table.setTplCategory("tree");when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(field("name","varchar(64)")));for(var options:List.of("{\"treeCode\":\"removed\",\"treeParentCode\":\"name\",\"treeName\":\"name\"}","private invalid JSON")){table.setOptions(options);assertThrows(ApiFailure.class,()->service.byId("9007199254740993","editor"));}verify(columns,never()).updateGenTableColumn(any());}
    @Test void zeroPhysicalUpdateFailsInsteadOfSuccess(){var old=field("name","varchar(64)");old.setColumnId(1L);when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(field("name","varchar(128)")));when(columns.selectGenTableColumnListByTableId(table.getTableId())).thenReturn(List.of(old));when(columns.updateGenTableColumn(any())).thenReturn(1);assertThrows(ApiFailure.class,()->service.byId("9007199254740993","editor"));}
    @Test void addedFieldsUseCurrentActorAndIncompleteDeletionFails(){var actual=field("new_name","varchar(64)");when(columns.selectDbTableColumnsByName("owned_table")).thenReturn(List.of(actual));when(columns.selectGenTableColumnListByTableId(table.getTableId())).thenReturn(List.of(field("removed","varchar(64)")));when(columns.insertGenTableColumn(any())).thenReturn(1);assertThrows(ApiFailure.class,()->service.byId("9007199254740993","editor"));assertEquals("editor",actual.getCreateBy());verify(columns).deleteGenTableColumns(any());}
}
