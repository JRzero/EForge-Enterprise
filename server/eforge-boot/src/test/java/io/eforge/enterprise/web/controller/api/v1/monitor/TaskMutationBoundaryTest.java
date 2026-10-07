package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.*;
import org.quartz.*;
import org.quartz.impl.StdSchedulerFactory;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.*;
import org.springframework.transaction.support.*;
import org.springframework.transaction.interceptor.*;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import io.eforge.enterprise.common.constant.ScheduleConstants;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.service.*;
import io.eforge.enterprise.quartz.service.impl.SysJobServiceImpl;
import io.eforge.enterprise.quartz.util.ScheduleUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real RAMJobStore and Spring transaction/advisor lifecycle, not a MySQL claim. */
class TaskMutationBoundaryTest {
    Scheduler scheduler;SysJobMapper mapper;Manager manager;TaskMutationBoundary boundary;
    @BeforeEach void setup() throws Exception {
        var properties=new Properties();properties.setProperty("org.quartz.scheduler.instanceName","owned-boundary-"+UUID.randomUUID());
        properties.setProperty("org.quartz.scheduler.skipUpdateCheck","true");properties.setProperty("org.quartz.scheduler.makeSchedulerThreadDaemon","true");
        properties.setProperty("org.quartz.threadPool.threadCount","1");properties.setProperty("org.quartz.threadPool.makeThreadsDaemons","true");
        properties.setProperty("org.quartz.jobStore.class","org.quartz.simpl.RAMJobStore");scheduler=new StdSchedulerFactory(properties).getScheduler();
        mapper=mock(SysJobMapper.class);manager=new Manager();boundary=new TaskMutationBoundary(scheduler,mapper,manager);
    }
    @AfterEach void close() throws Exception {scheduler.shutdown(true);}
    static SysJob row(long id,String group,String target,String status) {
        var row=new SysJob();row.setJobId(id);row.setJobName("Owned boundary");row.setJobGroup(group);row.setInvokeTarget(target);
        row.setCronExpression("0 0 0 1 1 ? 2099");row.setMisfirePolicy("3");row.setConcurrent("1");row.setStatus(status);return row;
    }
    static final class Manager extends AbstractPlatformTransactionManager {
        static final class State {boolean active;}
        Runnable commit=()->{};int commits,rollbacks;
        @Override protected Object doGetTransaction(){Object existing=TransactionSynchronizationManager.getResource(this);return existing==null?new State():existing;}
        @Override protected boolean isExistingTransaction(Object value){return ((State)value).active;}
        @Override protected void doBegin(Object value,TransactionDefinition definition){((State)value).active=true;TransactionSynchronizationManager.bindResource(this,value);}
        @Override protected void doCommit(DefaultTransactionStatus status){assertTrue(TransactionSynchronizationManager.isActualTransactionActive());commit.run();commits++;}
        @Override protected void doRollback(DefaultTransactionStatus status){rollbacks++;}
        @Override protected void doSetRollbackOnly(DefaultTransactionStatus status){}
        @Override protected void doCleanupAfterCompletion(Object value){((State)value).active=false;TransactionSynchronizationManager.unbindResource(this);}
    }
    @Test void admittedExecutionWaitsForActualCommitAndRejectsQueuedOldPayload() throws Exception {
        var old=row(811L,"DEFAULT","ryTask.ryNoParams()","0");var next=row(811L,"DEFAULT","ryTask.ryParams('next')","0");
        var committed=new AtomicReference<>(old);var reads=new AtomicInteger();when(mapper.selectJobById(811L)).thenAnswer(call->{reads.incrementAndGet();return committed.get();});
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);
        manager.commit=()->{entered.countDown();try {if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("Commit fixture timed out");}catch(InterruptedException failure){throw new RuntimeException(failure);}committed.set(next);};
        var executor=Executors.newFixedThreadPool(3);
        try {
            var mutation=executor.submit(()->{try{return boundary.mutate(new Object[]{next},()->{assertTrue(TransactionSynchronizationManager.isActualTransactionActive());ScheduleUtils.createScheduleJob(scheduler,next);return 1;});}catch(Throwable failure){throw new RuntimeException(failure);}});
            assertTrue(entered.await(5,TimeUnit.SECONDS));
            var queuedOld=executor.submit(()->boundary.admit(old,false));var queuedNew=executor.submit(()->boundary.admit(next,false));
            assertThrows(TimeoutException.class,()->queuedNew.get(100,TimeUnit.MILLISECONDS));assertEquals(0,reads.get());
            release.countDown();assertEquals(1,mutation.get(5,TimeUnit.SECONDS));
            assertInstanceOf(SchedulerException.class,assertThrows(ExecutionException.class,()->queuedOld.get(5,TimeUnit.SECONDS)).getCause());
            assertEquals(next.getInvokeTarget(),queuedNew.get(5,TimeUnit.SECONDS).getInvokeTarget());assertEquals(1,manager.commits);
        } finally {release.countDown();executor.shutdownNow();assertTrue(executor.awaitTermination(5,TimeUnit.SECONDS));}
    }
    @Test void checkedFailureRestoresCompleteBatchKeysPayloadDeadlinesAndUnrelatedSchedule() throws Exception {
        SysJob first=row(811L,"DEFAULT","ryTask.ryNoParams()","1"),second=row(812L,"SYSTEM","ryTask.ryNoParams()","0"),unrelated=row(813L,"DEFAULT","ryTask.ryNoParams()","0");
        for(var row:List.of(first,second,unrelated))ScheduleUtils.createScheduleJob(scheduler,row);
        var firstKey=ScheduleUtils.getJobKey(811L,"DEFAULT");var deadline=scheduler.getTriggersOfJob(firstKey).get(0).getNextFireTime();
        var unrelatedDeadline=scheduler.getTriggersOfJob(ScheduleUtils.getJobKey(813L,"DEFAULT")).get(0).getNextFireTime();
        assertThrows(Exception.class,()->boundary.mutate(new Object[]{new Long[]{811L,812L}},()->{
            scheduler.deleteJob(firstKey);scheduler.deleteJob(ScheduleUtils.getJobKey(812L,"SYSTEM"));ScheduleUtils.createScheduleJob(scheduler,row(811L,"NEW","ryTask.ryParams('failed')","0"));throw new Exception("owned checked fault");
        }));
        assertEquals(1,manager.rollbacks);assertEquals(0,manager.commits);assertFalse(scheduler.checkExists(ScheduleUtils.getJobKey(811L,"NEW")));
        assertEquals(deadline,scheduler.getTriggersOfJob(firstKey).get(0).getNextFireTime());
        assertEquals(Trigger.TriggerState.PAUSED,scheduler.getTriggerState(ScheduleUtils.getTriggerKey(811L,"DEFAULT")));
        assertTrue(scheduler.checkExists(ScheduleUtils.getJobKey(812L,"SYSTEM")));
        assertEquals(unrelatedDeadline,scheduler.getTriggersOfJob(ScheduleUtils.getJobKey(813L,"DEFAULT")).get(0).getNextFireTime());
    }
    @Test void generatedInsertIdIsRemovedWhenInsertFailsAfterScheduling() {
        var inserted=row(811L,"DEFAULT","ryTask.ryNoParams()","1");inserted.setJobId(null);
        assertThrows(Exception.class,()->boundary.mutate(new Object[]{inserted},()->{inserted.setJobId(899L);ScheduleUtils.createScheduleJob(scheduler,inserted);throw new Exception("owned insert fault");}));
        assertDoesNotThrow(()->assertFalse(scheduler.checkExists(ScheduleUtils.getJobKey(899L,"DEFAULT"))));
    }
    @Test void uncertainCommitOutcomeIsRecoveredFromCommittedSqlBeforeAdmission() throws Exception {
        SysJob old=row(811L,"DEFAULT","ryTask.ryNoParams()","0"),next=row(811L,"NEW","ryTask.ryParams('committed')","0");
        ScheduleUtils.createScheduleJob(scheduler,old);var committed=new AtomicReference<>(old);when(mapper.selectJobById(811L)).thenAnswer(call->committed.get());
        manager.commit=()->{committed.set(next);throw new TransactionSystemException("owned uncertain commit");};
        assertThrows(TransactionSystemException.class,()->boundary.mutate(new Object[]{next},()->{ScheduleUtils.createScheduleJob(scheduler,next);return 1;}));
        assertEquals(next.getInvokeTarget(),boundary.admit(next,false).getInvokeTarget());assertFalse(scheduler.checkExists(ScheduleUtils.getJobKey(811L,"DEFAULT")));
        assertTrue(scheduler.checkExists(ScheduleUtils.getJobKey(811L,"NEW")));assertThrows(SchedulerException.class,()->boundary.admit(old,true));
    }
    @Test void pausedManualAdmissionPreservedButAutomaticAndDeletedOrChangedConfigurationRejected() throws Exception {
        var paused=row(811L,"DEFAULT","ryTask.ryNoParams()","1");when(mapper.selectJobById(811L)).thenReturn(paused);
        assertEquals("1",boundary.admit(paused,true).getStatus());assertThrows(SchedulerException.class,()->boundary.admit(paused,false));
        var stale=row(811L,"DEFAULT","ryTask.ryParams('stale')","1");assertThrows(SchedulerException.class,()->boundary.admit(stale,true));
        when(mapper.selectJobById(811L)).thenReturn(null);assertThrows(SchedulerException.class,()->boundary.admit(paused,true));
    }
    @Test void databaseFaultIsSafeAndOuterTransactionCannotMutateOrAdmit() {
        var row=row(811L,"DEFAULT","ryTask.ryNoParams()","0");when(mapper.selectJobById(811L)).thenThrow(new IllegalStateException("jdbc secret"));
        assertFalse(assertThrows(SchedulerException.class,()->boundary.admit(row,false)).getMessage().contains("secret"));
        new TransactionTemplate(manager).execute(status->{assertThrows(SchedulerException.class,()->boundary.mutate(new Object[]{row},()->1));assertThrows(SchedulerException.class,()->boundary.admit(row,true));return null;});
        verify(mapper,times(1)).selectJobById(811L);
    }
    @Test void realAspectOutsideTransactionalAdvisorHasOneActualCommitAndNoReadAdvice() throws Exception {
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",scheduler);ReflectionTestUtils.setField(service,"jobMapper",mapper);
        var row=row(811L,"DEFAULT","ryTask.ryNoParams()","0");when(mapper.insertJob(row)).thenAnswer(call->{assertTrue(TransactionSynchronizationManager.isActualTransactionActive());return 1;});
        var factory=new AspectJProxyFactory(service);factory.setProxyTargetClass(true);factory.addAspect(new TaskMutationAspect(boundary));
        var attributes=new AnnotationTransactionAttributeSource();factory.addAdvice(new TransactionInterceptor(manager,attributes));
        SysJobServiceImpl proxy=factory.getProxy();assertEquals(1,proxy.insertJob(row));assertEquals(1,manager.commits);assertEquals("1",row.getStatus());
        proxy.selectJobById(811L);assertEquals(1,manager.commits);
    }
    @Test void legacyStaleStatusInputDoesNotOverwriteNewFieldsAndUsesCurrentGroup() throws Exception {
        var current=row(811L,"NEW","ryTask.ryParams('latest')","0");ScheduleUtils.createScheduleJob(scheduler,current);when(mapper.selectJobById(811L)).thenReturn(current);when(mapper.updateJob(any())).thenReturn(1);
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",scheduler);ReflectionTestUtils.setField(service,"jobMapper",mapper);
        var stale=row(811L,"OLD","ryTask.ryNoParams()","0");assertEquals(1,service.pauseJob(stale));
        var argument=org.mockito.ArgumentCaptor.forClass(SysJob.class);verify(mapper).updateJob(argument.capture());
        assertNull(argument.getValue().getInvokeTarget());assertNull(argument.getValue().getCronExpression());assertNull(argument.getValue().getMisfirePolicy());
        assertEquals(Trigger.TriggerState.PAUSED,scheduler.getTriggerState(ScheduleUtils.getTriggerKey(811L,"NEW")));
    }
    @Test void manualDispatchOccursOnlyAfterSuccessfulCommit() throws Exception {
        var observed=spy(scheduler);var row=row(811L,"DEFAULT","ryTask.ryNoParams()","1");ScheduleUtils.createScheduleJob(scheduler,row);
        when(mapper.selectJobById(811L)).thenReturn(row);
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",observed);ReflectionTestUtils.setField(service,"jobMapper",mapper);
        manager.commit=()->{assertDoesNotThrow(()->verify(observed,never()).triggerJob(any(JobKey.class),any(JobDataMap.class)));throw new TransactionSystemException("owned commit fault");};
        assertThrows(TransactionSystemException.class,()->boundary.mutate(new Object[]{row},()->service.run(row)));
        verify(observed,never()).triggerJob(any(JobKey.class),any(JobDataMap.class));
        manager.commit=()->assertDoesNotThrow(()->verify(observed,never()).triggerJob(any(JobKey.class),any(JobDataMap.class)));
        assertDoesNotThrow(()->assertEquals(true,boundary.mutate(new Object[]{row},()->service.run(row))));
        verify(observed,times(1)).triggerJob(eq(ScheduleUtils.getJobKey(811L,"DEFAULT")),argThat(data->Boolean.TRUE.equals(data.get(TaskMutationBoundary.MANUAL_RUN))));
    }
    @Test void persistentRestorationFaultBlocksAdmissionUntilCommittedSqlRecoverySucceeds() throws Exception {
        var row=row(811L,"DEFAULT","ryTask.ryNoParams()","0");ScheduleUtils.createScheduleJob(scheduler,row);
        when(mapper.selectJobById(811L)).thenReturn(row);
        var failing=spy(scheduler);var unavailable=new AtomicBoolean(true);
        doAnswer(call->{if(unavailable.get())throw new SchedulerException("owned persistent fault");return call.callRealMethod();}).when(failing).deleteJob(any(JobKey.class));
        var guarded=new TaskMutationBoundary(failing,mapper,manager);
        assertThrows(Exception.class,()->guarded.mutate(new Object[]{row},()->{throw new Exception("owned mutation fault");}));
        assertThrows(SchedulerException.class,()->guarded.admit(row,false));
        unavailable.set(false);assertEquals(row.getInvokeTarget(),guarded.admit(row,false).getInvokeTarget());
        assertTrue(scheduler.checkExists(ScheduleUtils.getJobKey(811L,"DEFAULT")));
    }
}
