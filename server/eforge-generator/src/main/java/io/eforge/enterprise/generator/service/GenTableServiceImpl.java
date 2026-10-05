package io.eforge.enterprise.generator.service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.StringWriter;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.IOUtils;
import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.Velocity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import io.eforge.enterprise.common.constant.Constants;
import io.eforge.enterprise.common.constant.GenConstants;
import io.eforge.enterprise.common.core.text.CharsetKit;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.domain.GenTableColumn;
import io.eforge.enterprise.generator.mapper.GenTableColumnMapper;
import io.eforge.enterprise.generator.mapper.GenTableMapper;
import io.eforge.enterprise.generator.util.GenUtils;
import io.eforge.enterprise.generator.util.VelocityInitializer;
import io.eforge.enterprise.generator.util.VelocityUtils;

/**
 * 业务 服务层实现
 * 
 * @author ruoyi
 */
@Service
public class GenTableServiceImpl implements IGenTableService
{
    private static final Logger log = LoggerFactory.getLogger(GenTableServiceImpl.class);

    @Autowired
    private GenTableMapper genTableMapper;

    @Autowired
    private GeneratorMetadataBoundary metadataBoundary;

    @Autowired
    private GenTableColumnMapper genTableColumnMapper;

    /**
     * 查询业务信息
     * 
     * @param id 业务ID
     * @return 业务信息
     */
    @Override
    public GenTable selectGenTableById(Long id)
    {
        GenTable genTable = genTableMapper.selectGenTableById(id);
        setTableFromOptions(genTable);
        return genTable;
    }

    /**
     * 查询业务列表
     * 
     * @param genTable 业务信息
     * @return 业务集合
     */
    @Override
    public List<GenTable> selectGenTableList(GenTable genTable)
    {
        return genTableMapper.selectGenTableList(genTable);
    }

    /**
     * 查询据库列表
     * 
     * @param genTable 业务信息
     * @return 数据库表集合
     */
    @Override
    public List<GenTable> selectDbTableList(GenTable genTable)
    {
        return genTableMapper.selectDbTableList(genTable);
    }

    /**
     * 查询据库列表
     * 
     * @param tableNames 表名称组
     * @return 数据库表集合
     */
    @Override
    public List<GenTable> selectDbTableListByNames(String[] tableNames)
    {
        return genTableMapper.selectDbTableListByNames(tableNames);
    }

    /**
     * 查询所有表信息
     * 
     * @return 表信息集合
     */
    @Override
    public List<GenTable> selectGenTableAll()
    {
        return genTableMapper.selectGenTableAll();
    }

    /**
     * 修改业务
     * 
     * @param genTable 业务信息
     * @return 结果
     */
    @Override
    @Transactional
    public void updateGenTable(GenTable genTable)
    {
        metadataBoundary.lock();
        GenTable previous = genTableMapper.selectGenTableById(genTable.getTableId());
        if (previous == null || genTable.getColumns() == null)
        {
            throw new ServiceException("生成配置不存在或字段集合不完整");
        }
        Map<Long, GenTableColumn> owned = previous.getColumns().stream().collect(Collectors.toMap(GenTableColumn::getColumnId, Function.identity()));
        java.util.Set<Long> seen = new java.util.HashSet<>();
        for (GenTableColumn field : genTable.getColumns())
        {
            if (field == null || field.getColumnId() == null)
            {
                throw new ServiceException("字段集合不完整");
            }
            GenTableColumn original = owned.get(field.getColumnId());
            if (original == null || !seen.add(field.getColumnId()))
            {
                throw new ServiceException("字段必须完整归属于当前生成配置");
            }
            field.setColumnType(original.getColumnType());
            field.setUpdateBy(io.eforge.enterprise.common.utils.SecurityUtils.getUsername());
        }
        if (seen.size() != owned.size())
        {
            throw new ServiceException("字段集合不完整，请重新加载");
        }
        String category = StringUtils.isEmpty(genTable.getTplCategory()) ? previous.getTplCategory() : genTable.getTplCategory();
        if (category == null || !java.util.Set.of(GenConstants.TPL_CRUD, GenConstants.TPL_TREE, GenConstants.TPL_SUB).contains(category))
        {
            throw new ServiceException("请选择有效生成类型");
        }
        genTable.setTplCategory(category);
        if (GenConstants.TPL_SUB.equals(category))
        {
            String childName = genTable.getSubTableName() == null ? previous.getSubTableName() : genTable.getSubTableName();
            String foreignKey = genTable.getSubTableFkName() == null ? previous.getSubTableFkName() : genTable.getSubTableFkName();
            GenTable child = genTableMapper.selectGenTableByName(childName);
            if (child == null || child.getTableId().equals(previous.getTableId()) || child.getColumns() == null || child.getColumns().stream().noneMatch(field -> java.util.Objects.equals(field.getColumnName(), foreignKey)))
            {
                throw new ServiceException("子表及关联字段必须存在且不能关联自身");
            }
            genTable.setSubTableName(childName);
            genTable.setSubTableFkName(foreignKey);
        }
        else
        {
            genTable.setSubTableName("");
            genTable.setSubTableFkName("");
        }
        if (GenConstants.TPL_TREE.equals(category))
        {
            java.util.Set<String> physicalNames = previous.getColumns().stream().map(GenTableColumn::getColumnName).collect(Collectors.toSet());
            for (String key : java.util.List.of(GenConstants.TREE_CODE, GenConstants.TREE_PARENT_CODE, GenConstants.TREE_NAME))
            {
                Object value = genTable.getParams().get(key);
                if (value == null || !physicalNames.contains(value.toString()))
                {
                    throw new ServiceException("树字段必须属于当前生成配置");
                }
            }
        }
        if (!java.util.Objects.equals(previous.getTableName(), genTable.getTableName()))
        {
            GenTable conflict = genTableMapper.selectGenTableByName(genTable.getTableName());
            List<GenTable> physical = genTableMapper.selectDbTableListByNames(new String[]{genTable.getTableName()});
            java.util.Set<String> physicalNames = genTableColumnMapper.selectDbTableColumnsByName(genTable.getTableName()).stream().map(GenTableColumn::getColumnName).collect(Collectors.toSet());
            java.util.Set<String> configuredNames = previous.getColumns().stream().map(GenTableColumn::getColumnName).collect(Collectors.toSet());
            if (conflict != null || physical.isEmpty() || !physicalNames.equals(configuredNames))
            {
                throw new ServiceException("目标表必须存在、未导入且字段集合相同");
            }
        }
        genTable.setUpdateBy(io.eforge.enterprise.common.utils.SecurityUtils.getUsername());
        String options = JSON.toJSONString(genTable.getParams());
        genTable.setOptions(options);
        int row = genTableMapper.updateGenTable(genTable);
        if (row != 1)
        {
            throw new ServiceException("生成配置保存失败");
        }
        if (row > 0)
        {
            metadataBoundary.renameReferences(previous.getTableName(), genTable.getTableName(), genTable.getUpdateBy());
            for (GenTableColumn genTableColumn : genTable.getColumns())
            {
                if (genTableColumnMapper.updateGenTableColumn(genTableColumn) != 1)
                {
                    throw new ServiceException("字段配置保存失败");
                }
            }
        }
    }

    /**
     * 删除业务对象
     * 
     * @param tableIds 需要删除的数据ID
     * @return 结果
     */
    @Override
    @Transactional
    public void deleteGenTableByIds(Long[] tableIds)
    {
        metadataBoundary.lock();
        metadataBoundary.assertDeletionAllowed(tableIds);
        genTableMapper.deleteGenTableByIds(tableIds);
        genTableColumnMapper.deleteGenTableColumnByIds(tableIds);
    }

    /**
     * 创建表
     *
     * @param sql 创建表语句
     * @return 结果
     */
    @Override
    public boolean createTable(String sql)
    {
        return genTableMapper.createTable(sql) == 0;
    }

    /**
     * 导入表结构
     * 
     * @param tableList 导入表列表
     */
    @Override
    @Transactional
    public void importGenTable(List<GenTable> tableList, String tplWebType, String operName)
    {
        metadataBoundary.lock();
        try
        {
            for (GenTable table : tableList)
            {
                String tableName = table.getTableName();
                table.setTplWebType(tplWebType);
                GenUtils.initTable(table, operName);
                int row = genTableMapper.insertGenTable(table);
                if (row > 0)
                {
                    // 保存列信息
                    List<GenTableColumn> genTableColumns = genTableColumnMapper.selectDbTableColumnsByName(tableName);
                    for (GenTableColumn column : genTableColumns)
                    {
                        GenUtils.initColumnField(column, table);
                        genTableColumnMapper.insertGenTableColumn(column);
                    }
                }
            }
        }
        catch (Exception e)
        {
            throw new ServiceException("导入失败：" + e.getMessage());
        }
    }

    /**
     * 预览代码
     * 
     * @param tableId 表编号
     * @return 预览数据列表
     */
    @Override
    public Map<String, String> previewCode(Long tableId)
    {
        Map<String, String> dataMap = new LinkedHashMap<>();
        // 查询表信息
        GenTable table = genTableMapper.selectGenTableById(tableId);
        // 设置主子表信息
        setSubTable(table);
        // 设置主键列信息
        setPkColumn(table);
        VelocityInitializer.initVelocity();

        VelocityContext context = VelocityUtils.prepareContext(table);

        // 获取模板列表
        List<String> templates = VelocityUtils.getTemplateList(table);
        for (String template : templates)
        {
            // 渲染模板
            StringWriter sw = new StringWriter();
            Template tpl = Velocity.getTemplate(template, Constants.UTF8);
            tpl.merge(context, sw);
            dataMap.put(template, sw.toString());
        }
        return dataMap;
    }

    /**
     * 生成代码（下载方式）
     * 
     * @param tableName 表名称
     * @return 数据
     */
    @Override
    public byte[] downloadCode(String tableName)
    {
        return downloadCode(new String[] { tableName });
    }

    /**
     * 生成代码（自定义路径）
     * 
     * @param tableName 表名称
     */
    @Override
    public void generatorCode(String tableName)
    {
        // 查询表信息
        GenTable table = genTableMapper.selectGenTableByName(tableName);
        // 设置主子表信息
        setSubTable(table);
        // 设置主键列信息
        setPkColumn(table);

        VelocityInitializer.initVelocity();

        VelocityContext context = VelocityUtils.prepareContext(table);

        // 获取模板列表
        List<String> templates = VelocityUtils.getTemplateList(table);
        for (String template : templates)
        {
            if (!StringUtils.containsAny(template, "sql.vm", "api.js.vm", "api.ts.vm", "type.ts.vm", "index.ts.vm", "index.vue.vm", "index-tree.vue.vm", "view.vue.vm"))
            {
                // 渲染模板
                StringWriter sw = new StringWriter();
                Template tpl = Velocity.getTemplate(template, Constants.UTF8);
                tpl.merge(context, sw);
                try
                {
                    String path = getGenPath(table, template);
                    FileUtils.writeStringToFile(new File(path), sw.toString(), CharsetKit.UTF_8);
                }
                catch (IOException e)
                {
                    throw new ServiceException("渲染模板失败，表名：" + table.getTableName());
                }
            }
        }
    }

    /**
     * 同步数据库
     * 
     * @param tableName 表名称
     */
    @Override
    @Transactional
    public void synchDb(String tableName)
    {
        metadataBoundary.lock();
        GenTable table = genTableMapper.selectGenTableByName(tableName);
        List<GenTableColumn> tableColumns = table.getColumns();
        Map<String, GenTableColumn> tableColumnMap = tableColumns.stream().collect(Collectors.toMap(GenTableColumn::getColumnName, Function.identity()));

        List<GenTableColumn> dbTableColumns = genTableColumnMapper.selectDbTableColumnsByName(tableName);
        if (StringUtils.isEmpty(dbTableColumns))
        {
            throw new ServiceException("同步数据失败，原表结构不存在");
        }
        List<String> dbTableColumnNames = dbTableColumns.stream().map(GenTableColumn::getColumnName).collect(Collectors.toList());

        dbTableColumns.forEach(column -> {
            GenUtils.initColumnField(column, table);
            if (tableColumnMap.containsKey(column.getColumnName()))
            {
                GenTableColumn prevColumn = tableColumnMap.get(column.getColumnName());
                column.setColumnId(prevColumn.getColumnId());
                if (column.isList())
                {
                    // 如果是列表，继续保留查询方式/字典类型选项
                    column.setDictType(prevColumn.getDictType());
                    column.setQueryType(prevColumn.getQueryType());
                }
                if (StringUtils.isNotEmpty(prevColumn.getIsRequired()) && !column.isPk()
                        && (column.isInsert() || column.isEdit())
                        && ((column.isUsableColumn()) || (!column.isSuperColumn())))
                {
                    // 如果是(新增/修改&非主键/非忽略及父属性)，继续保留必填/显示类型选项
                    column.setIsRequired(prevColumn.getIsRequired());
                    column.setHtmlType(prevColumn.getHtmlType());
                }
                genTableColumnMapper.updateGenTableColumn(column);
            }
            else
            {
                genTableColumnMapper.insertGenTableColumn(column);
            }
        });

        List<GenTableColumn> delColumns = tableColumns.stream().filter(column -> !dbTableColumnNames.contains(column.getColumnName())).collect(Collectors.toList());
        if (StringUtils.isNotEmpty(delColumns))
        {
            genTableColumnMapper.deleteGenTableColumns(delColumns);
        }
    }

    /**
     * 批量生成代码（下载方式）
     * 
     * @param tableNames 表数组
     * @return 数据
     */
    @Override
    public byte[] downloadCode(String[] tableNames)
    {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ZipOutputStream zip = new ZipOutputStream(outputStream);
        Map<String, StringBuffer> typeFiles = new HashMap<>();
        for (String tableName : tableNames)
        {
            generatorCode(tableName, zip, typeFiles);
        }
        for (Map.Entry<String, StringBuffer> entry : typeFiles.entrySet())
        {
            writeToZip(zip, entry.getKey(), entry.getValue().toString());
        }
        IOUtils.closeQuietly(zip);
        return outputStream.toByteArray();
    }

    /**
     * 查询表信息并生成代码
     */
    private void generatorCode(String tableName, ZipOutputStream zip, Map<String, StringBuffer> typeFiles)
    {
        // 查询表信息
        GenTable table = genTableMapper.selectGenTableByName(tableName);
        // 设置主子表信息
        setSubTable(table);
        // 设置主键列信息
        setPkColumn(table);

        VelocityInitializer.initVelocity();

        VelocityContext context = VelocityUtils.prepareContext(table);

        // 获取模板列表
        List<String> templates = VelocityUtils.getTemplateList(table);
        for (String template : templates)
        {
            // 渲染模板
            StringWriter sw = new StringWriter();
            Template tpl = Velocity.getTemplate(template, Constants.UTF8);
            tpl.merge(context, sw);
            String fileName = VelocityUtils.getFileName(template, table);
            // index-bak.ts 模版，追加内容
            if (fileName.contains("index-bak.ts"))
            {
                if (!typeFiles.containsKey(fileName))
                {
                    typeFiles.put(fileName, new StringBuffer(sw.toString()));
                }
                else
                {
                    Arrays.stream(sw.toString().split("\n")).filter(line -> line.startsWith("export * from")).forEach(line -> typeFiles.get(fileName).append("\n").append(line));
                }
            }
            else
            {
                // 其他文件正常添加
                writeToZip(zip, fileName, sw.toString());
            }
        }
    }

    /**
     * 将字符串内容写入ZIP输出流
     * 
     * @param zip ZIP输出流
     * @param fileName ZIP条目名称（即文件名）
     * @param content 要写入的内容
     */
    private void writeToZip(ZipOutputStream zip, String fileName, String content)
    {
        try
        {
            zip.putNextEntry(new ZipEntry(fileName));
            IOUtils.write(content, zip, Constants.UTF8);
            zip.flush();
            zip.closeEntry();
        }
        catch (IOException e)
        {
            log.error("写入ZIP文件失败，文件名: " + fileName, e);
        }
    }

    /**
     * 修改保存参数校验
     * 
     * @param genTable 业务信息
     */
    @Override
    public void validateEdit(GenTable genTable)
    {
        if (GenConstants.TPL_TREE.equals(genTable.getTplCategory()))
        {
            String options = JSON.toJSONString(genTable.getParams());
            JSONObject paramsObj = JSON.parseObject(options);
            if (StringUtils.isEmpty(paramsObj.getString(GenConstants.TREE_CODE)))
            {
                throw new ServiceException("树编码字段不能为空");
            }
            else if (StringUtils.isEmpty(paramsObj.getString(GenConstants.TREE_PARENT_CODE)))
            {
                throw new ServiceException("树父编码字段不能为空");
            }
            else if (StringUtils.isEmpty(paramsObj.getString(GenConstants.TREE_NAME)))
            {
                throw new ServiceException("树名称字段不能为空");
            }
        }
        else if (GenConstants.TPL_SUB.equals(genTable.getTplCategory()))
        {
            if (StringUtils.isEmpty(genTable.getSubTableName()))
            {
                throw new ServiceException("关联子表的表名不能为空");
            }
            else if (StringUtils.isEmpty(genTable.getSubTableFkName()))
            {
                throw new ServiceException("子表关联的外键名不能为空");
            }
        }
    }

    /**
     * 设置主键列信息
     * 
     * @param table 业务表信息
     */
    public void setPkColumn(GenTable table)
    {
        for (GenTableColumn column : table.getColumns())
        {
            if (column.isPk())
            {
                table.setPkColumn(column);
                break;
            }
        }
        if (StringUtils.isNull(table.getPkColumn()))
        {
            table.setPkColumn(table.getColumns().get(0));
        }
        if (GenConstants.TPL_SUB.equals(table.getTplCategory()))
        {
            for (GenTableColumn column : table.getSubTable().getColumns())
            {
                if (column.isPk())
                {
                    table.getSubTable().setPkColumn(column);
                    break;
                }
            }
            if (StringUtils.isNull(table.getSubTable().getPkColumn()))
            {
                table.getSubTable().setPkColumn(table.getSubTable().getColumns().get(0));
            }
        }
    }

    /**
     * 设置主子表信息
     * 
     * @param table 业务表信息
     */
    public void setSubTable(GenTable table)
    {
        String subTableName = table.getSubTableName();
        if (StringUtils.isNotEmpty(subTableName))
        {
            table.setSubTable(genTableMapper.selectGenTableByName(subTableName));
        }
    }

    /**
     * 设置代码生成其他选项值
     * 
     * @param genTable 设置后的生成对象
     */
    public void setTableFromOptions(GenTable genTable)
    {
        JSONObject paramsObj = JSON.parseObject(genTable.getOptions());
        if (StringUtils.isNotNull(paramsObj))
        {
            String treeCode = paramsObj.getString(GenConstants.TREE_CODE);
            String treeParentCode = paramsObj.getString(GenConstants.TREE_PARENT_CODE);
            String treeName = paramsObj.getString(GenConstants.TREE_NAME);
            Long parentMenuId = paramsObj.getLongValue(GenConstants.PARENT_MENU_ID);
            String parentMenuName = paramsObj.getString(GenConstants.PARENT_MENU_NAME);
            boolean isView = paramsObj.getBooleanValue(GenConstants.GEN_VIEW);

            genTable.setTreeCode(treeCode);
            genTable.setTreeParentCode(treeParentCode);
            genTable.setTreeName(treeName);
            genTable.setParentMenuId(parentMenuId);
            genTable.setParentMenuName(parentMenuName);
            genTable.setView(isView);
        }
    }

    /**
     * 获取代码生成地址
     * 
     * @param table 业务表信息
     * @param template 模板文件路径
     * @return 生成地址
     */
    public static String getGenPath(GenTable table, String template)
    {
        String genPath = table.getGenPath();
        if (StringUtils.equals(genPath, "/"))
        {
            return System.getProperty("user.dir") + File.separator + "src" + File.separator + VelocityUtils.getFileName(template, table);
        }
        return genPath + File.separator + VelocityUtils.getFileName(template, table);
    }
}