package io.eforge.enterprise.generator.util;

import java.util.*;
import com.alibaba.druid.sql.ast.*;
import com.alibaba.druid.sql.ast.expr.SQLIdentifierExpr;
import com.alibaba.druid.sql.ast.statement.*;
import com.alibaba.druid.sql.dialect.mysql.ast.statement.MySqlCreateTableStatement;
import com.alibaba.druid.sql.dialect.mysql.visitor.MySqlASTVisitorAdapter;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Resolve lexical CTE bindings before physical source preflight; no SQL execution. */
final class GeneratorCreationSourceResolver extends MySqlASTVisitorAdapter {
    private final String schema;
    private final java.util.function.UnaryOperator<String> fold;
    private final MySqlCreateTableStatement table;
    private final Deque<Set<String>> scopes = new ArrayDeque<>();
    private final Set<String> references = new LinkedHashSet<>();
    private final Set<String> reads = new LinkedHashSet<>();
    private final Set<String> foreignKeys = new LinkedHashSet<>();
    private String like;
    record Sources(Set<String> all, Set<String> reads, Set<String> foreignKeys, String like) {}
    private GeneratorCreationSourceResolver(MySqlCreateTableStatement table, String schema, java.util.function.UnaryOperator<String> fold) {
        this.table = table; this.schema = schema; this.fold = fold;
        scopes.push(Set.of());
    }
    static Sources resolve(MySqlCreateTableStatement table, String schema, java.util.function.UnaryOperator<String> fold) {
        var resolver = new GeneratorCreationSourceResolver(table, schema, fold);
        table.accept(resolver);
        if (table.getWithSelect() != null) table.getWithSelect().accept(resolver);
        return new Sources(Collections.unmodifiableSet(new LinkedHashSet<>(resolver.references)), Collections.unmodifiableSet(new LinkedHashSet<>(resolver.reads)), Collections.unmodifiableSet(new LinkedHashSet<>(resolver.foreignKeys)), resolver.like);
    }
    @Override public boolean visit(SQLSelect select) {
        var visible = new HashSet<>(scopes.peek());
        scopes.push(visible);
        try {
            var with = select.getWithSubQuery();
            if (with != null) {
                var local = new HashSet<String>();
                for (var entry : with.getEntries()) {
                    String name = key(GeneratorCreationBatchParser.localName(new SQLIdentifierExpr(entry.getAlias()), schema, fold));
                    if (!local.add(name) || entry.getSubQuery() == null || entry.getReturningStatement() != null || entry.getExpr() != null)
                        throw invalid();
                    // A later CTE is not visible in this definition. Nonrecursive self may be a base table.
                    if (Boolean.TRUE.equals(with.getRecursive())) visible.add(name);
                    entry.getSubQuery().accept(this);
                    visible.add(name);
                }
            }
            if (select.getQuery() != null) select.getQuery().accept(this);
            if (select.getOrderBy() != null) select.getOrderBy().accept(this);
            if (select.getLimit() != null) select.getLimit().accept(this);
            return false;
        } finally { scopes.pop(); }
    }
    @Override public void preVisit(SQLObject node) {
        if (node instanceof SQLExprTableSource source && source != table.getTableSource()) {
            if (!(source.getExpr() instanceof SQLName name)) throw invalid();
            String physical = GeneratorCreationBatchParser.localName(name, schema, fold);
            // Qualified names always address the schema, even when a CTE has the same simple name.
            if (!(name instanceof SQLIdentifierExpr) || !scopes.peek().contains(key(physical))) {
                references.add(physical);
                if (source == table.getLike()) like = physical; else reads.add(physical);
            }
        }
        if (node instanceof SQLForeignKeyConstraint foreignKey) foreignKey(foreignKey.getReferencedTableName());
        if (node instanceof SQLColumnReference inlineReference) foreignKey(inlineReference.getTable());
    }
    private void foreignKey(SQLName name) {
        String physical = GeneratorCreationBatchParser.localName(name, schema, fold);
        references.add(physical); foreignKeys.add(physical);
    }
    private String key(String value) { return fold.apply(value); }
    private static ApiFailure invalid() { return new ApiFailure(400, "GENERATOR_CREATE_SQL_INVALID", "Invalid common table expression or source."); }
}