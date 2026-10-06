package io.eforge.enterprise.web.controller.api.v1.tool;

import java.io.StringWriter;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.apache.velocity.app.Velocity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.rendering.GeneratorRenderingSnapshot;
import io.eforge.enterprise.generator.util.*;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorRenderingSnapshotTest {
    private GenTableColumn field(String name,String javaField,String type) {
        var field=new GenTableColumn();field.setColumnId(9007199254740995L);field.setTableId(9007199254740997L);
        field.setColumnName(name);field.setColumnComment("中文字段");field.setColumnType("bigint");
        field.setJavaField(javaField);field.setJavaType(type);field.setIsPk("0");field.setIsIncrement("0");
        field.setIsRequired("1");field.setIsInsert("1");field.setIsEdit("1");field.setIsList("1");field.setIsQuery("1");
        field.setQueryType("EQ");field.setHtmlType("input");field.setDictType("");field.setSort(1);return field;
    }
    private GenTable table(String category,String webType) {
        var table=new GenTable();table.setTableId(9007199254740997L);table.setTableName("snapshot_entries");
        table.setTableComment("快照表");table.setClassName("SnapshotEntry");table.setTplCategory(category);table.setTplWebType(webType);
        table.setPackageName("io.eforge.enterprise.generated");table.setModuleName("sales");table.setBusinessName("entry");
        table.setFunctionName("快照功能");table.setFunctionAuthor("作者");table.setFormColNum(3);table.setGenType("1");table.setGenPath("D:/生成输出");
        table.setOptions("{\"treeCode\":\"id\",\"treeParentCode\":\"parent_id\",\"treeName\":\"name\",\"parentMenuId\":\"3\",\"parentMenuName\":\"系统工具\",\"generateDetail\":true}");
        table.setTreeCode("id");table.setTreeParentCode("parent_id");table.setTreeName("name");table.setParentMenuId(3L);table.setParentMenuName("系统工具");table.setView(true);
        var id=field("id","id","Long");id.setIsPk("1");id.setIsIncrement("1");id.setIsRequired("0");
        var parent=field("parent_id","parentId","Long");parent.setIsEdit("0");
        var name=field("name","name","String");name.setHtmlType("select");name.setDictType("sys_normal_disable");name.setQueryType("LIKE");
        table.setColumns(new ArrayList<>(List.of(id,parent,name)));table.setPkColumn(id);
        table.setCreateBy("creator");table.setUpdateBy("updater");table.setRemark("原备注");table.setSearchValue("private-query");
        if(category.equals("sub")) {
            var child=table("crud",webType);child.setTableId(9007199254740999L);child.setTableName("snapshot_lines");child.setClassName("SnapshotLine");
            table.setSubTableName("snapshot_lines");table.setSubTableFkName("parent_id");table.setSubTable(child);
        }
        return table;
    }
    @Test void capturedSourceAndEveryWorkingCopyAreIndependentWithOriginalAliases() {
        var source=table("sub","element-plus-typescript");
        var time=new Timestamp(1700000000123L);time.setNanos(123456789);
        source.setCreateTime(time);source.setUpdateTime(time);
        var nested=new LinkedHashMap<String,Object>();nested.put("timestamp",time);nested.put("decimal",new BigDecimal("9007199254740993123.0000001"));
        var sequence=new ArrayList<Object>(Arrays.asList(nested,null));source.getParams().put("nested",sequence);
        var snapshot=GeneratorRenderingSnapshot.capture(source);
        source.setClassName("Changed");source.getPkColumn().setJavaField("changed");source.getSubTable().setTableComment("Changed child");
        time.setNanos(9);nested.put("decimal",BigDecimal.ZERO);sequence.clear();
        var first=snapshot.legacyWorkingTable();
        assertEquals("SnapshotEntry",first.getClassName());assertEquals(9007199254740997L,first.getTableId());
        assertEquals("快照表",first.getSubTable().getTableComment());assertSame(first.getPkColumn(),first.getColumns().get(0));
        assertSame(first.getCreateTime(),first.getUpdateTime());assertEquals(123456789,((Timestamp)first.getCreateTime()).getNanos());
        var copiedSequence=(List<?>)first.getParams().get("nested");var copiedMap=(Map<?,?>)copiedSequence.get(0);
        assertNull(copiedSequence.get(1));assertSame(first.getCreateTime(),copiedMap.get("timestamp"));
        assertEquals(new BigDecimal("9007199254740993123.0000001"),copiedMap.get("decimal"));
        first.getColumns().clear();first.getSubTable().setTableName("changed_again");first.getCreateTime().setTime(0);first.getParams().clear();
        var second=snapshot.legacyWorkingTable();
        assertEquals(3,second.getColumns().size());assertEquals("id",second.getPkColumn().getJavaField());
        assertEquals("snapshot_lines",second.getSubTable().getTableName());assertEquals(123456789,((Timestamp)second.getCreateTime()).getNanos());
        assertNotSame(second.getSubTable(),first.getSubTable());assertNotSame(second.getCreateTime(),first.getCreateTime());
        assertTrue(first.isSub());assertTrue(second.isView());assertEquals("D:/生成输出",second.getGenPath());
        assertEquals("sys_normal_disable",second.getColumns().get(2).getDictType());assertEquals("LIKE",second.getColumns().get(2).getQueryType());
        assertEquals("0",second.getColumns().get(1).getIsEdit());assertEquals("原备注",second.getRemark());assertEquals("private-query",second.getSearchValue());
    }
    @Test void nullableMetadataAndSqlDateTimeKindsArePreservedWithoutUsingToInstant() {
        var source=table("tree","element-ui");source.setCreateTime(new java.sql.Date(1700000000000L));
        source.setUpdateTime(new java.sql.Time(1700000000123L));source.setRemark(null);source.setParentMenuId(null);
        var snapshot=GeneratorRenderingSnapshot.capture(source);var copy=snapshot.legacyWorkingTable();
        assertEquals(java.sql.Date.class,copy.getCreateTime().getClass());assertEquals(java.sql.Time.class,copy.getUpdateTime().getClass());
        assertEquals(1700000000123L,copy.getUpdateTime().getTime());assertNull(copy.getRemark());assertNull(copy.getParentMenuId());
        assertTrue(copy.isTree());assertEquals("parent_id",copy.getTreeParentCode());assertEquals(source.getOptions(),copy.getOptions());
        assertTrue(snapshot.generationDate().matches("\\d{4}-\\d{2}-\\d{2}"));
    }
    @Test void cyclesAndUnexpectedMutableParameterValuesCannotEscapeTheBoundary() {
        var source=table("crud","element-ui");source.setSubTable(source);
        var cycle=assertThrows(ApiFailure.class,()->GeneratorRenderingSnapshot.capture(source));assertEquals("GENERATOR_SNAPSHOT_INVALID",cycle.code());
        source.setSubTable(null);source.getParams().put("private",new AtomicInteger(1));
        var mutable=assertThrows(ApiFailure.class,()->GeneratorRenderingSnapshot.capture(source));
        assertEquals("Generator metadata cannot be captured safely.",mutable.getMessage());assertEquals(400,mutable.status());
        assertThrows(ApiFailure.class,()->GeneratorRenderingSnapshot.capture(null));
    }
    static Stream<Arguments> templates() {
        return Stream.of("crud","tree","sub").flatMap(category->Stream.of("element-ui","element-plus","element-plus-typescript").map(web->Arguments.of(category,web)));
    }
    private Map<String,String> render(GenTable table,String date) {
        VelocityInitializer.initVelocity();var context=VelocityUtils.prepareContext(table);context.put("datetime",date);
        var result=new LinkedHashMap<String,String>();
        for(String template:VelocityUtils.getTemplateList(table)) {
            var writer=new StringWriter();Velocity.getTemplate(template,"UTF-8").merge(context,writer);
            result.put(template+"|"+VelocityUtils.getFileName(template,table),writer.toString());
        }
        return result;
    }
    @ParameterizedTest @MethodSource("templates")
    void realOriginalTemplateSetsKeepCompleteCrudTreeAndSubtableOutput(String category,String web) {
        var source=table(category,web);var snapshot=GeneratorRenderingSnapshot.capture(source);
        var before=render(source,snapshot.generationDate());
        assertEquals(before,render(snapshot.legacyWorkingTable(),snapshot.generationDate()));
        source.setFunctionName("changed");source.getColumns().get(2).setColumnComment("changed");
        assertEquals(before,render(snapshot.legacyWorkingTable(),snapshot.generationDate()));
        assertTrue(before.size()>=9);assertTrue(before.keySet().stream().anyMatch(name->name.startsWith("vm/xml/mapper.xml.vm")));
    }
}
