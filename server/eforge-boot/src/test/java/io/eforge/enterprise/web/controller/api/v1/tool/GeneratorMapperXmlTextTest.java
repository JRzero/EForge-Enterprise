package io.eforge.enterprise.web.controller.api.v1.tool;

import java.io.StringReader;
import java.io.StringWriter;
import java.util.*;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.apache.velocity.app.Velocity;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.util.*;
import io.eforge.enterprise.generator.rendering.GeneratorOutputText;
import static org.junit.jupiter.api.Assertions.*;

class GeneratorMapperXmlTextTest {
    public static class Entry {
        public Long getId(){return 4L;}
        public String getLabel(){return "x'); DROP TABLE victim; --";}
        public Long getParentId(){return 4L;}
        public Map<String,Object> getParams(){return Map.of("beginLabel","first","endLabel","last");}
        public List<Entry> getChildLineList(){return List.of();}
    }
    private GenTableColumn field(String physical,String javaName,String type) {
        var field=new GenTableColumn();field.setColumnName(physical);field.setJavaField(javaName);
        field.setJavaType(type);field.setIsPk("0");field.setIsIncrement("0");field.setIsQuery("1");
        field.setIsRequired("0");field.setQueryType("EQ");return field;
    }
    private GenTable table(String category,String query) {
        var table=new GenTable();table.setTableName("表`\"<&. select");table.setClassName("RootText");
        table.setTplCategory(category);table.setTplWebType("element-plus");table.setPackageName("generated");
        table.setModuleName("test");table.setBusinessName("entry");table.setFunctionName("标签");table.setFormColNum(1);
        table.setOptions("{\"treeCode\":\"id\",\"treeParentCode\":\"parent_id\",\"treeName\":\"label\"}");
        var id=field("编号`\"<&. --","id","Long");id.setIsPk("1");id.setIsIncrement("1");
        var label=field("列`\"<&. --","label","String");label.setQueryType(query);
        table.setColumns(List.of(id,label));table.setPkColumn(id);
        if(category.equals("sub")){
            var child=table("crud",query);child.setClassName("ChildLine");child.setTableName("子表`\"<&. select");
            var parent=field("parent_id","parentId","Long");
            child.setColumns(List.of(child.getPkColumn(),parent,child.getColumns().get(1)));
            table.setSubTable(child);table.setSubTableName(child.getTableName());table.setSubTableFkName("parent_id");
        }
        return table;
    }
    @ParameterizedTest
    @CsvSource({"crud,EQ","crud,NE","crud,GT","crud,GTE","crud,LT","crud,LTE","crud,LIKE","crud,BETWEEN","tree,EQ","sub,EQ"})
    void actualOriginalMapperParsesAndBindsPhysicalNamesAsIdentifiers(String category,String query){
        var table=table(category,query);VelocityInitializer.initVelocity();
        var text=new StringWriter();Velocity.getTemplate("vm/xml/mapper.xml.vm","UTF-8").merge(VelocityUtils.prepareContext(table),text);
        var configuration=new Configuration();configuration.getTypeAliasRegistry().registerAlias("RootText",Entry.class);
        configuration.getTypeAliasRegistry().registerAlias("ChildLine",Entry.class);
        new XMLMapperBuilder(new StringReader(text.toString()),configuration,"generated.xml",configuration.getSqlFragments()).parse();
        var mappings=configuration.getResultMap("generated.mapper.RootTextMapper.RootTextResult").getResultMappings();
        assertEquals(List.of(table.getPkColumn().getColumnName(),table.getColumns().get(1).getColumnName()),mappings.stream().map(m->m.getColumn()).toList());
        for(String statement:List.of("selectRootTextList","selectRootTextById","insertRootText","updateRootText","deleteRootTextById","deleteRootTextByIds")){
            Object parameters=statement.endsWith("Ids")?Map.of("array",new Long[]{4L,5L}):new Entry();
            var bound=configuration.getMappedStatement("generated.mapper.RootTextMapper."+statement).getBoundSql(parameters);
            assertTrue(bound.getSql().contains(GeneratorOutputText.mysqlIdentifier(table.getTableName())),bound.getSql());
            assertFalse(bound.getSql().contains("DROP TABLE victim"));assertFalse(bound.getSql().contains("&amp;"));
            assertFalse(bound.getParameterMappings().isEmpty(),statement);
        }
        var list=configuration.getMappedStatement("generated.mapper.RootTextMapper.selectRootTextList").getBoundSql(new Entry());
        assertTrue(list.getSql().contains(GeneratorOutputText.mysqlIdentifier(table.getColumns().get(1).getColumnName())));
        assertEquals(query.equals("BETWEEN")?3:2,list.getParameterMappings().size());
        if(category.equals("sub")){
            for(String statement:List.of("selectChildLineList","deleteChildLineByParentId","deleteChildLineByParentIds","batchChildLine")){
                Object parameter=statement.endsWith("Ids")?Map.of("array",new Long[]{4L}):statement.startsWith("batch")?Map.of("list",List.of(new Entry())):new Entry();
                var bound=configuration.getMappedStatement("generated.mapper.RootTextMapper."+statement).getBoundSql(parameter);
                assertTrue(bound.getSql().contains(GeneratorOutputText.mysqlIdentifier(table.getSubTableName())));
                assertFalse(bound.getSql().contains("DROP TABLE victim"));assertFalse(bound.getParameterMappings().isEmpty());
            }
        }
    }
}