package io.eforge.enterprise.workflow;

import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.flowable.engine.ProcessEngine;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import io.eforge.enterprise.workflow.purchase.PurchaseService;
import static org.assertj.core.api.Assertions.*;

class PurchaseMysqlTest {
    @Test void actualMysqlConcurrentCreationDecisionAndAuditRollback() {
        Assumptions.assumeTrue(System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL")!=null,"Requires owned MySQL fixture");
        new ApplicationContextRunner().withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
            .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
                "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=false")
            .run(context->{
                assertThat(context).hasNotFailed();var source=context.getBean(DataSource.class);var jdbc=new JdbcTemplate(source);
                jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_role(role_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_user_role(user_id bigint,role_id bigint)");
                jdbc.execute("create table sys_role_menu(role_id bigint,menu_id bigint)");
                jdbc.execute("create table sys_menu(menu_id bigint primary key,status char(1),perms varchar(100))");
                jdbc.update("insert into sys_user values(1,'0','0'),(2,'0','0'),(3,'0','0')");jdbc.update("insert into sys_role values(2,'0','0')");
                jdbc.update("insert into sys_user_role values(2,2)");jdbc.update("insert into sys_role_menu values(2,1)");jdbc.update("insert into sys_menu values(1,'0','sample:purchase:approve')");
                WorkflowLeaveServiceTest.publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
                String leave=context.getBean(WorkflowReleases.class).activation("leave").releaseId();
                PurchaseServiceTest.publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
                assertThat(context.getBean(WorkflowReleases.class).activation("leave").releaseId()).isEqualTo(leave);
                var engine=context.getBean(ProcessEngine.class);
                var delegate=context.getBean(WorkflowUnitOfWork.class);
                var observed=new WorkflowUnitOfWork(){public <T>T execute(java.util.function.Supplier<T> work){return delegate.execute(()->{
                    try{return work.get();}catch(RuntimeException failure){
                        // Test-only diagnostics: class and SQLState, never SQL text, arguments or credentials.
                        for(Throwable cause=failure;cause!=null;cause=cause.getCause()){
                            System.out.println("Purchase fixture failure type="+cause.getClass().getSimpleName()+(cause instanceof java.sql.SQLException sql?" state="+sql.getSQLState():""));
                            if(cause==cause.getCause())break;
                        }
                        throw failure;
                    }
                });}};
                var service=new PurchaseService(source,observed,engine);
                var edit=new WorkflowPurchases.Edit("测试采购","保持十进制","2",List.of(new WorkflowPurchases.ItemInput("a","设备","台","0.005","1.00"),new WorkflowPurchases.ItemInput("b","设备二","台","0.005","1.00")));
                String creation=UUID.randomUUID().toString();var pool=Executors.newFixedThreadPool(2);
                try{
                    var gate=new CyclicBarrier(2);
                    Callable<WorkflowPurchases.Purchase> create=()->{gate.await(10,TimeUnit.SECONDS);return service.create(creation,edit,"1");};
                    var one=pool.submit(create);var two=pool.submit(create);var draft=one.get(20,TimeUnit.SECONDS);
                    assertThat(two.get(20,TimeUnit.SECONDS)).isEqualTo(draft);assertThat(draft.total()).isEqualTo("0.02");
                    assertThat(jdbc.queryForObject("select count(*) from ef_purchase",Long.class)).isEqualTo(1);
                    var submit=new WorkflowPurchases.Command(UUID.randomUUID().toString(),1,"");
                    jdbc.execute("alter table ef_purchase_audit add constraint purchase_submit_fault check (action <> 'SUBMIT')");
                    assertThatThrownBy(()->service.submit(draft.id(),submit,"1")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
                    assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
                    assertThat(service.get(draft.id(),"1").purchase().status()).isEqualTo("DRAFT");
                    jdbc.execute("alter table ef_purchase_audit drop check purchase_submit_fault");var pending=service.submit(draft.id(),submit,"1");
                    assertThat(service.submit(draft.id(),submit,"1")).isEqualTo(pending);
                    assertThatThrownBy(()->service.get(draft.id(),"3")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(404));
                    jdbc.update("delete from sys_role_menu");
                    assertThatThrownBy(()->service.decide(draft.id(),new WorkflowPurchases.Command(UUID.randomUUID().toString(),2,""),true,"2")).isInstanceOf(ApiFailure.class);
                    jdbc.update("insert into sys_role_menu values(2,1)");
                    var decisions=new CyclicBarrier(2);
                    Callable<String> approve=()->{decisions.await(10,TimeUnit.SECONDS);try{return service.decide(draft.id(),new WorkflowPurchases.Command(UUID.randomUUID().toString(),2,""),true,"2").status();}catch(ApiFailure f){return Integer.toString(f.status());}};
                    var first=pool.submit(approve);var second=pool.submit(approve);
                    assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder("APPROVED","409");
                    assertThat(service.get(draft.id(),"1").history()).hasSize(3);
                    assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
                    assertThat(jdbc.queryForObject("select total from ef_purchase where id=?",java.math.BigDecimal.class,draft.id())).isEqualByComparingTo("0.02");
                }finally{pool.shutdownNow();}
            });
    }
}
