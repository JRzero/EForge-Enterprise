package io.eforge.enterprise.workflow;

import java.lang.reflect.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.flowable.engine.ProcessEngine;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowLeaveQueryBudgetTest {
    @Test void listBusinessQueriesStayBoundedAndRetainPageAndEligibility() {
        new WorkflowLeaveServiceTest().runner.run(context->{
            var source=context.getBean(DataSource.class);
            var jdbc=WorkflowLeaveServiceTest.prepare(source);
            WorkflowLeaveServiceTest.publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
            verifyLists(source,jdbc,context.getBean(WorkflowUnitOfWork.class),context.getBean(ProcessEngine.class));
        });
    }
    static void verifyLists(DataSource source,org.springframework.jdbc.core.JdbcTemplate jdbc,WorkflowUnitOfWork transaction,ProcessEngine engine){
            jdbc.update("insert into sys_user values (4,'0','0')"); jdbc.update("insert into sys_user_role values (4,2)");
            var counted=new CountingSource(source);
            var leaves=new WorkflowLeaveService(counted,transaction,engine);
            for(int i=0;i<5;i++)leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"申请"+i),"3");
            counted.queries.clear();var mine=leaves.mine("3",1,5);int mineQueries=counted.queries.size();
            assertThat(mine.items()).hasSize(5);assertThat(mine.total()).isEqualTo(5);
            assertThat(mine.items()).extracting(WorkflowLeaves.Leave::id).containsExactlyElementsOf(jdbc.queryForList("select id from ef_workflow_leave where initiator_id='3' order by created_at desc,id desc",String.class));
            counted.queries.clear();var pending=leaves.pending("4",1,5);int pendingQueries=counted.queries.size();
            assertThat(pending.items()).hasSize(5).allMatch(WorkflowLeaves.Pending::canHandle);
            assertThat(leaves.mine("3",2,3).items()).containsExactlyElementsOf(mine.items().subList(3,5));
            for(var item:pending.items().subList(0,2)){
                leaves.claim(item.leave().id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,item.task().id(),""),"4");
                leaves.decide(item.leave().id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,item.task().id(),"同意"),true,"4");
            }
            counted.queries.clear();var handled=leaves.handled("4",1,5);int handledQueries=counted.queries.size();
            assertThat(handled.items()).hasSize(2).allMatch(row->row.status().equals("APPROVED"));
            System.out.printf("LEAVE QUERY BASELINE: mine=%d pending=%d handled=%d (business JDBC only)%n",mineQueries,pendingQueries,handledQueries);
            assertThat(mineQueries).isEqualTo(3);assertThat(pendingQueries).isEqualTo(3);assertThat(handledQueries).isEqualTo(3);
            counted.queries.clear();assertThat(leaves.pending("4",100,5).items()).isEmpty();assertThat(counted.queries).hasSize(2);
            var broken=leaves.pending("4",1,5).items().get(0).leave();
            jdbc.update("update ef_workflow_leave set process_id=null where id=?",broken.id());
            try{assertThatThrownBy(()->leaves.pending("4",1,5)).isInstanceOfSatisfying(io.eforge.enterprise.common.exception.ApiFailure.class,f->assertThat(f.status()).isEqualTo(503));}
            finally{jdbc.update("update ef_workflow_leave set process_id=? where id=?",broken.processId(),broken.id());}
            assertThat(leaves.pending("4",1,5).items()).hasSize(3);
    }

    /** Counts actual business JDBC executions; engine SQL uses its original source separately. */
    static final class CountingSource extends AbstractDataSource {
        final TransactionAwareDataSourceProxy delegate;
        final List<String> queries=new ArrayList<>();
        CountingSource(DataSource source){delegate=new TransactionAwareDataSourceProxy(source);}
        @Override public Connection getConnection()throws SQLException{return wrap(delegate.getConnection());}
        @Override public Connection getConnection(String user,String password)throws SQLException{return wrap(delegate.getConnection(user,password));}
        private Connection wrap(Connection connection){
            return (Connection)Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{Connection.class},(proxy,method,args)->{
                Object result=invoke(connection,method,args);
                if(method.getName().equals("prepareStatement")&&result instanceof PreparedStatement statement){
                    String sql=(String)args[0];
                    return Proxy.newProxyInstance(getClass().getClassLoader(),new Class<?>[]{PreparedStatement.class},(p,m,a)->{
                        if(m.getName().equals("executeQuery"))queries.add(sql);
                        return invoke(statement,m,a);
                    });
                }
                return result;
            });
        }
        private static Object invoke(Object target,Method method,Object[] args)throws Throwable{
            try{return method.invoke(target,args);}catch(InvocationTargetException failure){throw failure.getCause();}
        }
    }
}
