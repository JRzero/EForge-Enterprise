package io.eforge.enterprise.generator.util;

import java.util.*;
import com.alibaba.druid.DbType;
import com.alibaba.druid.sql.SQLUtils;
import com.alibaba.druid.sql.ast.*;
import com.alibaba.druid.sql.ast.expr.*;
import com.alibaba.druid.sql.ast.statement.*;
import com.alibaba.druid.sql.dialect.mysql.ast.MysqlPartitionSingle;
import com.alibaba.druid.sql.dialect.mysql.ast.expr.MySqlOutFileExpr;
import com.alibaba.druid.sql.dialect.mysql.ast.statement.*;
import com.alibaba.druid.sql.dialect.mysql.visitor.MySqlASTVisitorAdapter;
import com.alibaba.druid.sql.dialect.mysql.visitor.MySqlOutputVisitor;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Pure AST policy. Database preflight, role checks, SQL mode and execution are separate. */
public final class GeneratorCreationAstPolicy {
    private GeneratorCreationAstPolicy() {}
    private static final Set<String> ENGINES = Set.of("INNODB", "MYISAM", "MEMORY", "CSV", "ARCHIVE", "BLACKHOLE");
    private static final Set<String> OPTIONS = words("ENGINE AUTO_INCREMENT AVG_ROW_LENGTH CHARSET CHARACTERSET COLLATE COMMENT COMPRESSION ENCRYPTION CHECKSUM DELAY_KEY_WRITE INSERT_METHOD KEY_BLOCK_SIZE MAX_ROWS MIN_ROWS PACK_KEYS ROW_FORMAT STATS_AUTO_RECALC STATS_PERSISTENT STATS_SAMPLE_PAGES");
    // Native built-ins only: unknown/loadable/stored functions fail closed.
    private static final Set<String> FUNCTIONS = words("ABS ACOS ASIN ATAN ATAN2 CEIL CEILING COS COT DEGREES EXP FLOOR LN LOG LOG10 LOG2 MOD PI POW POWER RADIANS ROUND SIGN SIN SQRT TAN TRUNCATE "
        +"ASCII BIN BIT_LENGTH CHAR CHAR_LENGTH CHARACTER_LENGTH CONCAT CONCAT_WS ELT FIELD FIND_IN_SET FORMAT HEX INSTR LCASE LEFT LENGTH LOCATE LOWER LPAD LTRIM OCT OCTET_LENGTH ORD QUOTE REPLACE REVERSE RIGHT RPAD RTRIM SPACE STRCMP SUBSTR SUBSTRING SUBSTRING_INDEX TRIM UCASE UNHEX UPPER "
        +"ADDDATE ADDTIME CONVERT_TZ CURDATE CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP CURTIME DATE DATEDIFF DATE_ADD DATE_FORMAT DATE_SUB DAY DAYNAME DAYOFMONTH DAYOFWEEK DAYOFYEAR EXTRACT FROM_DAYS FROM_UNIXTIME HOUR LAST_DAY LOCALTIME LOCALTIMESTAMP MAKEDATE MAKETIME MICROSECOND MINUTE MONTH MONTHNAME NOW PERIOD_ADD PERIOD_DIFF QUARTER SECOND SEC_TO_TIME STR_TO_DATE SUBDATE SUBTIME TIME TIMEDIFF TIMESTAMP TIMESTAMPADD TIMESTAMPDIFF TIME_FORMAT TIME_TO_SEC TO_DAYS TO_SECONDS UNIX_TIMESTAMP UTC_DATE UTC_TIME UTC_TIMESTAMP WEEK WEEKDAY WEEKOFYEAR YEAR YEARWEEK "
        +"COALESCE IF IFNULL ISNULL NULLIF GREATEST LEAST CAST CONVERT UUID "
        +"AVG COUNT GROUP_CONCAT MAX MIN SUM BIT_AND BIT_OR BIT_XOR STD STDDEV STDDEV_POP STDDEV_SAMP VAR_POP VAR_SAMP VARIANCE JSON_ARRAYAGG JSON_OBJECTAGG "
        +"CUME_DIST DENSE_RANK FIRST_VALUE LAG LAST_VALUE LEAD NTH_VALUE NTILE PERCENT_RANK RANK ROW_NUMBER "
        +"JSON_ARRAY JSON_OBJECT JSON_CONTAINS JSON_CONTAINS_PATH JSON_EXTRACT JSON_KEYS JSON_OVERLAPS JSON_SEARCH JSON_VALUE JSON_APPEND JSON_ARRAY_APPEND JSON_ARRAY_INSERT JSON_INSERT JSON_MERGE JSON_MERGE_PATCH JSON_MERGE_PRESERVE JSON_REMOVE JSON_REPLACE JSON_SET JSON_UNQUOTE JSON_DEPTH JSON_LENGTH JSON_TYPE JSON_VALID");

    public record PreparedTable(String name, String sql, Set<String> references,
                                Set<String> readReferences, Set<String> foreignKeyReferences, String likeReference) {
        public PreparedTable {
            references = Collections.unmodifiableSet(new LinkedHashSet<>(references));
            readReferences = Collections.unmodifiableSet(new LinkedHashSet<>(readReferences));
            foreignKeyReferences = Collections.unmodifiableSet(new LinkedHashSet<>(foreignKeyReferences));
        }
    }
    public static boolean isLocalEngine(String name) {
        return name != null && ENGINES.contains(name.toUpperCase(Locale.ROOT));
    }
    public static List<PreparedTable> prepare(String sql, String currentSchema) {
        return prepare(sql, currentSchema, 0);
    }
    public static List<PreparedTable> prepare(String sql, String currentSchema, int lowerCaseTableNames) {
        if (lowerCaseTableNames < 0 || lowerCaseTableNames > 2) throw unsafe();
        return prepare(sql,currentSchema,lowerCaseTableNames,lowerCaseTableNames==0
            ? java.util.function.UnaryOperator.identity() : value -> {
                var result=new StringBuilder();value.codePoints().map(Character::toLowerCase).forEach(result::appendCodePoint);return result.toString();
            });
    }
    /** Production preflight supplies native database folding instead of guessing Unicode identifier rules. */
    public static List<PreparedTable> prepare(String sql,String currentSchema,int lowerCaseTableNames,
                                              java.util.function.UnaryOperator<String> fold) {
        if (lowerCaseTableNames < 0 || lowerCaseTableNames > 2) throw unsafe();
        var parsed = GeneratorCreationBatchParser.parse(sql, currentSchema, fold);
        var prepared = new ArrayList<PreparedTable>();
        for (var item : parsed) {
            var table = item.astCopy();
            root(table);
            var visitor = new MySqlASTVisitorAdapter() {
                @Override public void preVisit(SQLObject node) {
                    if (node instanceof SQLHint || node instanceof SQLVariantRefExpr || node instanceof MySqlOutFileExpr) throw unsafe();
                    if (node instanceof SQLMethodInvokeExpr method && (method.getOwner() != null
                            || !FUNCTIONS.contains(method.getMethodName().toUpperCase(Locale.ROOT)))) throw unsafe();
                    if (node instanceof SQLBinaryOpExpr binary && binary.getOperator() == SQLBinaryOperator.Assignment) throw unsafe();
                    if (node instanceof SQLSelectQueryBlock query && (query.getInto() != null || query.isForUpdate() || query.isForShare() || query.getWaitTime() != null)) throw unsafe();
                    if (node instanceof MySqlSelectQueryBlock query && (query.isLockInShareMode() || query.getProcedureName() != null || query.isCalcFoundRows())) throw unsafe();
                    if (node instanceof SQLPartitionSingle partition && (partition.getTablespace() != null || partition.getLocality() != null)) throw unsafe();
                    if (node instanceof MysqlPartitionSingle partition) {
                        if (partition.getDataDirectory() != null || partition.getIndexDirectory() != null) throw unsafe();
                        engine(partition.getEngine());
                    }
                    if (node instanceof SQLSubPartition partition) {
                        if (partition.getDataDirectory() != null || partition.getIndexDirectory() != null || partition.getTableSpace() != null) throw unsafe();
                        engine(partition.getEngine());
                        if (partition.getMaxRows() != null && !(partition.getMaxRows() instanceof SQLIntegerExpr)) throw unsafe();
                        if (partition.getMinRows() != null && !(partition.getMinRows() instanceof SQLIntegerExpr)) throw unsafe();
                        if (partition.getComment() != null && !(partition.getComment() instanceof SQLCharExpr)) throw unsafe();
                    }
                }
            };
            visitAll(table, visitor);
            // No-op CREATE cannot establish this request's ownership after a race.
            table.setIfNotExists(false);
            var sources = GeneratorCreationSourceResolver.resolve(table, currentSchema, fold);
            prepared.add(new PreparedTable(item.name(), render(table), sources.all(), sources.reads(), sources.foreignKeys(), sources.like()));
        }
        return List.copyOf(prepared);
    }
    /** Correct two pinned formatter losses without changing the dependency baseline. */
    private static String render(MySqlCreateTableStatement table) {
        var output = new StringBuilder();
        table.accept(new MySqlOutputVisitor(output) {
            @Override public boolean visit(SQLPartitionByRange range) {
                // The stock formatter infers COLUMNS from SQLName, ignoring isColumns().
                print0(range.isColumns() ? "RANGE COLUMNS (" : "RANGE (");
                printAndAccept(range.getColumns(), ", ");
                print(')');
                if (range.getInterval() != null) {
                    print0(" INTERVAL ("); range.getInterval().accept(this); print(')');
                }
                printPartitionsCountAndSubPartitions(range);
                printSQLPartitions(range.getPartitions());
                return false;
            }
            @Override public boolean visit(SQLSubPartition partition) {
                super.visit(partition);
                option("ENGINE", partition.getEngine());
                option("MAX_ROWS", partition.getMaxRows());
                option("MIN_ROWS", partition.getMinRows());
                option("COMMENT", partition.getComment());
                return false;
            }
            private void option(String name, SQLExpr value) {
                if (value != null) { print0(" " + name + " = "); value.accept(this); }
            }
        });
        return output.toString();
    }
    private static void visitAll(MySqlCreateTableStatement table, MySqlASTVisitorAdapter visitor) {
        table.accept(visitor);
        if (table.getWithSelect() != null) table.getWithSelect().accept(visitor);
        // Pinned visitor omits generated expressions and parts of partition metadata.
        for (var column : table.getColumnDefinitions()) {
            if (column.getAsExpr() != null) column.getAsExpr().accept(visitor);
            if (column.getGeneratedAlwaysAs() != null) column.getGeneratedAlwaysAs().accept(visitor);
            if (column.getDefaultExpr() != null) column.getDefaultExpr().accept(visitor);
            if (column.getOnUpdate() != null) column.getOnUpdate().accept(visitor);
        }
        if (table.getPartitioning() != null) {
            var partitioning = table.getPartitioning(); partitioning.accept(visitor);
            for (var partition : partitioning.getPartitions()) {
                partition.accept(visitor);
                if (partition instanceof SQLPartitionSingle single)
                    for (var sub : single.getSubPartitions()) sub.accept(visitor);
            }
        }
    }
    private static void root(MySqlCreateTableStatement table) {
        if (table.isTemporary() || table.isExternal() || table.isReplace() || table.isIgnore()
                || table.getTablespace() != null || table.getStoredAs() != null || table.getStoredBy() != null
                || table.getLocation() != null || table.getInherits() != null || table.getPartitionOf() != null
                || table.getLocalPartitioning() != null || table.getRowFormat() != null
                || (table.getWithSelect() != null && !(table.getWithSelect() instanceof SQLSelectStatement)) || table.getTableGroup() != null || table.getArchiveBy() != null
                || table.getDbPartitionBy() != null || table.getTablePartitionBy() != null || table.getExtPartition() != null
                || !table.getDistributeBy().isEmpty() || (table.getWith() != null && !table.getWith().isEmpty())) throw unsafe();
        engine(table.getEngine());
        for (var option : table.getTableOptions()) {
            String name = atom(option.getTarget()).replace(" ", "").replace("_", "").toUpperCase(Locale.ROOT);
            if (!OPTIONS.contains(name) && !OPTIONS.contains(atom(option.getTarget()).toUpperCase(Locale.ROOT))) throw unsafe();
            atom(option.getValue());
            if (name.equals("ENGINE")) engine(option.getValue());
        }
    }
    private static void engine(SQLExpr expression) {
        if (expression != null && !ENGINES.contains(atom(expression).toUpperCase(Locale.ROOT))) throw unsafe();
    }
    private static String atom(SQLExpr expression) {
        if (expression instanceof SQLIdentifierExpr identifier) return identifier.getName();
        if (expression instanceof SQLCharExpr text) return text.getText();
        if (expression instanceof SQLIntegerExpr number) return number.getNumber().toString();
        throw unsafe();
    }
    private static Set<String> words(String words) { return Set.of(words.split(" +")); }
    private static ApiFailure unsafe() { return new ApiFailure(400, "GENERATOR_CREATE_SQL_UNSAFE", "Table creation contains unsupported or unsafe operations."); }
}