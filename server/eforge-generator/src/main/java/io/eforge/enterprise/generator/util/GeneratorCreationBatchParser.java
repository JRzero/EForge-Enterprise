package io.eforge.enterprise.generator.util;

import java.util.*;
import com.alibaba.druid.DbType;
import com.alibaba.druid.sql.SQLUtils;
import com.alibaba.druid.sql.ast.*;
import com.alibaba.druid.sql.ast.expr.*;
import com.alibaba.druid.sql.ast.statement.SQLExprTableSource;
import com.alibaba.druid.sql.ast.statement.SQLForeignKeyConstraint;
import com.alibaba.druid.sql.ast.statement.SQLColumnReference;
import com.alibaba.druid.sql.dialect.mysql.ast.statement.MySqlCreateTableStatement;
import com.alibaba.druid.sql.dialect.mysql.visitor.MySqlASTVisitorAdapter;
import com.alibaba.druid.sql.parser.ParserException;
import com.alibaba.druid.sql.parser.Token;
import com.alibaba.druid.sql.dialect.mysql.parser.MySqlLexer;
import com.alibaba.druid.sql.dialect.mysql.parser.MySqlStatementParser;
import com.alibaba.druid.sql.dialect.mysql.parser.MySqlCreateTableParser;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Parsing foundation only. Not an execution policy; no endpoint calls this yet. */
public final class GeneratorCreationBatchParser {
    private GeneratorCreationBatchParser() {}
    public static final int MAX_CHARACTERS = 65_536;
    public static final int MAX_TABLES = 100;

    /** AST copies protect the parsed snapshot from later caller mutations. */
    public static final class ParsedTable {
        private final String name;
        private final String originalBatch;
        private final int statementIndex;
        private final Set<String> references;
        private ParsedTable(String name, String originalBatch, int statementIndex, Set<String> references) {
            this.name = name; this.originalBatch = originalBatch; this.statementIndex = statementIndex;
            this.references = Collections.unmodifiableSet(new LinkedHashSet<>(references));
        }
        public String name() { return name; }
        public MySqlCreateTableStatement astCopy() {
            // Both clone() and rendering omit some pinned AST fields; reparse immutable input.
            return (MySqlCreateTableStatement) parseAstBatch(originalBatch).get(statementIndex);
        }
        public Set<String> references() { return references; }
    }

    public static List<ParsedTable> parse(String sql, String currentSchema) {
        return parse(sql, currentSchema, java.util.function.UnaryOperator.identity());
    }
    static List<ParsedTable> parse(String sql, String currentSchema, java.util.function.UnaryOperator<String> fold) {
        if (sql == null || sql.isBlank() || sql.length() > MAX_CHARACTERS
                || currentSchema == null || currentSchema.isBlank()) throw invalid();
        rejectExecutableCommentsAndDeepBrackets(sql);
        final List<SQLStatement> statements;
        try { checkTokenComplexity(sql); statements = parseAstBatch(sql); }
        catch (ParserException | IllegalArgumentException malformed) { throw invalid(); }
        if (statements.isEmpty() || statements.size() > MAX_TABLES) throw invalid();
        var names = new HashSet<String>();
        var result = new ArrayList<ParsedTable>();
        int statementIndex = 0;
        for (var statement : statements) {
            if (!(statement instanceof MySqlCreateTableStatement table)) throw invalid();
            String name = localName(table.getName(), currentSchema, fold);
            if (!names.add(name.toLowerCase(Locale.ROOT))) throw invalid();
            var references = new LinkedHashSet<String>();
            table.accept(new MySqlASTVisitorAdapter() {
                int depth, nodes;
                @Override public void preVisit(SQLObject node) {
                    if (++depth > 128 || ++nodes > 20_000) throw invalid();
                    // Druid traverses FK SQLName directly, not its SQLExprTableSource wrapper.
                    if (node instanceof SQLColumnReference inlineReference)
                        references.add(localName(inlineReference.getTable(), currentSchema, fold));
                    if (node instanceof SQLForeignKeyConstraint foreignKey)
                        references.add(localName(foreignKey.getReferencedTableName(), currentSchema, fold));
                    if (node instanceof SQLExprTableSource source && source != table.getTableSource()) {
                        if (!(source.getExpr() instanceof SQLName reference)) throw invalid();
                        references.add(localName(reference, currentSchema, fold));
                    }
                }
                @Override public void postVisit(SQLObject node) { --depth; }
            });
            result.add(new ParsedTable(name, sql, statementIndex++, references));
        }
        return List.copyOf(result);
    }

    /** Keep the lexical RANGE/COLUMNS distinction lost by the pinned MySQL parser. */
    private static List<SQLStatement> parseAstBatch(String sql) {
        return new MySqlStatementParser(sql) {
            @Override public MySqlCreateTableStatement parseCreateTable() {
                return getSQLCreateTableParser().parseCreateTable();
            }
            @Override public MySqlCreateTableParser getSQLCreateTableParser() {
                return new MySqlCreateTableParser(exprParser) {
                    private boolean rangeColumns() {
                        var position = lexer.mark();
                        if (lexer.identifierEquals("RANGE")) lexer.nextToken();
                        boolean columns = lexer.identifierEquals("COLUMNS");
                        lexer.reset(position);
                        return columns;
                    }
                    @Override protected SQLPartitionByRange partitionByRange() {
                        boolean columns = rangeColumns();
                        var range = super.partitionByRange(); range.setColumns(columns); return range;
                    }
                    @Override protected SQLPartitionByRange partitionByRange1() {
                        boolean columns = rangeColumns();
                        var range = super.partitionByRange1(); range.setColumns(columns); return range;
                    }
                };
            }
        }.parseStatementList();
    }
    /** Lexer is iterative: reject recursive prefixes/CASE before the recursive parser. */
    private static void checkTokenComplexity(String sql) {
        var lexer = new MySqlLexer(sql);
        int tokens = 0, prefixes = 0, cases = 0, recursiveTokens = 0;
        do {
            lexer.nextToken();
            var token = lexer.token();
            if (++tokens > 20_000 || token == Token.ERROR || token == Token.VARIANT || token == Token.COLONEQ) throw invalid();
            if (token == Token.SEMI) recursiveTokens = 0;
            // Pinned lexer folds two exclamation prefixes (even spaced) into BANGBANG.
            int prefixWeight = token == Token.BANGBANG ? 2
                : (token == Token.NOT || token == Token.BANG || token == Token.TILDE || token == Token.PLUS || token == Token.SUB) ? 1 : 0;
            recursiveTokens += prefixWeight + (token == Token.CASE ? 1 : 0);
            if (recursiveTokens > 256) throw invalid();
            if (prefixWeight > 0) {
                prefixes += prefixWeight;
                if (prefixes > 64) throw invalid();
            } else prefixes = 0;
            if (token == Token.CASE && ++cases > 64) throw invalid();
            if (token == Token.END && cases > 0) cases--;
        } while (lexer.token() != Token.EOF);
    }
    static String localName(SQLName name, String schema) {
        return localName(name, schema, java.util.function.UnaryOperator.identity());
    }
    static String localName(SQLName name, String schema, java.util.function.UnaryOperator<String> fold) {
        String simple;
        if (name instanceof SQLIdentifierExpr identifier) simple = unquote(identifier.getName());
        else if (name instanceof SQLPropertyExpr property && property.getOwner() instanceof SQLIdentifierExpr owner) {
            if (!fold.apply(schema).equals(fold.apply(unquote(owner.getName())))) throw invalid();
            simple = unquote(property.getName());
        } else throw invalid();
        if (simple.isBlank() || simple.length() > 64 || simple.endsWith(" ")
                || simple.codePoints().anyMatch(c -> Character.isISOControl(c) || c == '/' || c == '\\' || c == '.' || c > 0xffff))
            throw invalid();
        return simple;
    }
    private static String unquote(String value) {
        if (value.startsWith("`") && value.endsWith("`")) return value.substring(1, value.length()-1).replace("``", "`");
        if (value.startsWith("\"") || value.startsWith("'")) throw invalid();
        return value;
    }

    /** Recognize comments outside quoted data; this is not a SQL keyword filter. */
    private static void rejectExecutableCommentsAndDeepBrackets(String sql) {
        char quote = 0; int brackets = 0;
        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            if (quote != 0) {
                if (c == '\\' && quote != '`') { i++; continue; }
                if (c == quote) {
                    if (i+1 < sql.length() && sql.charAt(i+1) == quote) i++;
                    else quote = 0;
                }
                continue;
            }
            if (c == '\'' || c == '"' || c == '`') { quote = c; continue; }
            if (c == '#' || (c == '-' && i+2 < sql.length() && sql.charAt(i+1) == '-' && Character.isWhitespace(sql.charAt(i+2)))) {
                while (i+1 < sql.length() && sql.charAt(i+1) != '\n' && sql.charAt(i+1) != '\r') i++;
                continue;
            }
            if (c == '/' && i+1 < sql.length() && sql.charAt(i+1) == '*') {
                if (i+2 < sql.length() && (sql.charAt(i+2) == '!' || sql.charAt(i+2) == '+')) throw invalid();
                int end = sql.indexOf("*/", i+2);
                if (end < 0) throw invalid();
                i = end+1; continue;
            }
            if (c == '(' && ++brackets > 64) throw invalid();
            if (c == ')' && --brackets < 0) throw invalid();
        }
        if (quote != 0 || brackets != 0) throw invalid();
    }
    private static ApiFailure invalid() {
        return new ApiFailure(400, "GENERATOR_CREATE_SQL_INVALID", "The complete table creation batch is invalid.");
    }
}