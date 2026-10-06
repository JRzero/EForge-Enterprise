package io.eforge.enterprise.generator.service;

import java.sql.*;
import java.util.*;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Physical phase only: no metadata transaction and no compensating DROP. */
public final class GeneratorCreationExecution {
    private GeneratorCreationExecution() {}
    public enum State { CREATED, FAILED, UNATTEMPTED, UNCONFIRMED }
    public record Outcome(String name, State state, String code) {}
    public record Result(List<Outcome> tables) {
        public Result { tables=List.copyOf(tables); }
        public boolean allCreated() { return !tables.isEmpty() && tables.stream().allMatch(t -> t.state()==State.CREATED); }
    }
    /** The caller supplies an owned autocommit connection, never a request-selected datasource. */
    public static Result execute(Connection connection,String sql) {
        try {
            if(!connection.getAutoCommit() || connection.isReadOnly())
                throw new ApiFailure(409,"GENERATOR_CREATE_CONNECTION_INVALID","Physical creation requires a separate writable autocommit connection.");
        } catch(SQLException unavailable) {
            throw new ApiFailure(503,"GENERATOR_CREATE_PREFLIGHT_UNAVAILABLE","Table creation could not inspect the database safely.");
        }
        var plan=GeneratorCreationPreflight.inspect(connection,sql);
        var outcomes=new ArrayList<Outcome>();
        boolean stopped=false;
        for(var table:plan.tables()) {
            if(stopped) {outcomes.add(new Outcome(table.name(),State.UNATTEMPTED,"GENERATOR_CREATE_NOT_ATTEMPTED"));continue;}
            boolean dispatched=false, acknowledged=false;
            try(var statement=connection.createStatement()) {
                statement.setQueryTimeout(30);
                dispatched=true;
                statement.execute(table.sql());
                acknowledged=true;
                outcomes.add(new Outcome(table.name(),State.CREATED,"GENERATOR_CREATE_CREATED"));
            } catch(SQLException failure) {
                // A close failure after an acknowledged CREATE cannot revoke that acknowledgement.
                if(acknowledged) {
                    stopped=true;
                    continue;
                }
                String state=failure.getSQLState();
                boolean uncertain=dispatched && (failure instanceof SQLTimeoutException
                    || failure instanceof SQLTransientConnectionException || failure instanceof SQLNonTransientConnectionException
                    || state==null || state.startsWith("08"));
                State outcome=!dispatched?State.UNATTEMPTED:uncertain?State.UNCONFIRMED:State.FAILED;
                String code=outcome==State.UNATTEMPTED?"GENERATOR_CREATE_NOT_ATTEMPTED"
                    :outcome==State.UNCONFIRMED?"GENERATOR_CREATE_UNCONFIRMED"
                    :failure.getErrorCode()==1050?"GENERATOR_CREATE_TARGET_EXISTS":"GENERATOR_CREATE_DDL_FAILED";
                outcomes.add(new Outcome(table.name(),outcome,code));
                stopped=true;
            }
        }
        return new Result(outcomes);
    }
}